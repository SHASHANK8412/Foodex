"""Foodex streaming job (Spark Structured Streaming on Kafka).

One Spark application, four streaming queries over the foodex.* topics:

    order_windows   orders and revenue per restaurant per 1-minute window
    trending_items  quantity ordered per dish per 1-minute window
    funnel          events per funnel stage per 1-minute window
                    -> all three are published to the foodex.analytics.realtime
                       topic, which the API consumes and pushes to the admin
                       dashboard over Socket.io
    bronze_events   every raw event, appended to the data lake as Parquet
                    partitioned by topic and date

    spark-submit \
      --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.4 \
      streaming_pipeline.py --brokers localhost:9092 --lake lake --checkpoints checkpoints

Aggregations use event time (the `occurredAt` field set by the producer) with a
watermark, so late events are still counted in the window they belong to until
the watermark passes. Queries run in `update` mode: each trigger emits only the
windows whose value changed.
"""

import argparse
import os

from pyspark.sql import SparkSession
from pyspark.sql import functions as F

from foodex_schemas import (
    EVENT_SCHEMA,
    SOURCE_TOPICS,
    TOPIC_ANALYTICS_REALTIME,
    TOPIC_CLICKSTREAM,
    TOPIC_ORDER_CREATED,
    TOPIC_ORDER_PAID,
)

WINDOW = "1 minute"
WATERMARK = "2 minutes"


def join_path(base, *parts):
    return "/".join([base.rstrip("/\\")] + list(parts))


def build_spark(app_name):
    return (
        SparkSession.builder.appName(app_name)
        .config("spark.sql.session.timeZone", "UTC")
        # Small state stores: the default of 200 shuffle partitions is far too many here.
        .config("spark.sql.shuffle.partitions", os.environ.get("SPARK_SHUFFLE_PARTITIONS", "4"))
        .getOrCreate()
    )


def read_kafka(spark, brokers, starting_offsets="latest", max_offsets_per_trigger=50000):
    return (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", brokers)
        .option("subscribe", ",".join(SOURCE_TOPICS))
        .option("startingOffsets", starting_offsets)
        .option("maxOffsetsPerTrigger", max_offsets_per_trigger)
        .option("failOnDataLoss", "false")
        .load()
    )


# ------------------------------------------------------------------ transformations
# Plain DataFrame -> DataFrame functions, so they can be unit-tested on static data.


def to_bronze(kafka_df):
    """Raw events exactly as they arrived, plus where they came from."""
    return kafka_df.select(
        "topic",
        "partition",
        "offset",
        F.col("timestamp").alias("kafka_ts"),
        F.col("key").cast("string").alias("key"),
        F.col("value").cast("string").alias("json"),
        F.to_date(F.col("timestamp")).alias("event_date"),
    )


def parse_events(kafka_df):
    """Decodes the JSON envelope and derives the event-time column."""
    return (
        kafka_df.select(
            "topic",
            F.col("timestamp").alias("kafka_ts"),
            F.from_json(F.col("value").cast("string"), EVENT_SCHEMA).alias("event"),
        )
        .where(F.col("event").isNotNull())
        .select("topic", "kafka_ts", "event.*")
        # Producer time when present and valid, broker time otherwise.
        .withColumn("event_time", F.coalesce(F.to_timestamp("occurredAt"), F.col("kafka_ts")))
    )


def to_kafka_record(dataframe, metric, key_column, *value_columns):
    """Shapes an aggregate as a Kafka record whose value is the JSON the API expects."""
    return dataframe.select(
        F.col(key_column).cast("string").alias("key"),
        F.to_json(
            F.struct(
                F.lit(metric).alias("metric"),
                F.col("window.start").alias("windowStart"),
                F.col("window.end").alias("windowEnd"),
                *[F.col(column) for column in value_columns],
            )
        ).alias("value"),
    )


def order_windows(events):
    aggregated = (
        events.where(F.col("topic") == TOPIC_ORDER_CREATED)
        .where(F.col("restaurantId").isNotNull())
        .withWatermark("event_time", WATERMARK)
        # The name is grouped on rather than picked with first(): it is fixed per
        # restaurant, and grouping keeps the aggregate deterministic.
        .groupBy(F.window("event_time", WINDOW), "restaurantId", "restaurantName")
        .agg(
            F.count("*").alias("orders"),
            F.round(F.sum(F.coalesce(F.col("totalAmount"), F.lit(0.0))), 2).alias("revenue"),
        )
    )
    return to_kafka_record(aggregated, "order_window", "restaurantId", "restaurantId", "restaurantName", "orders", "revenue")


def trending_items(events):
    aggregated = (
        events.where(F.col("topic") == TOPIC_ORDER_CREATED)
        .select("event_time", F.explode("items").alias("item"))
        .where(F.col("item.name").isNotNull())
        .select("event_time", F.col("item.name").alias("itemName"), F.coalesce(F.col("item.quantity"), F.lit(1)).alias("qty"))
        .withWatermark("event_time", WATERMARK)
        .groupBy(F.window("event_time", WINDOW), "itemName")
        .agg(F.sum("qty").alias("quantity"))
    )
    return to_kafka_record(aggregated, "trending_item", "itemName", "itemName", "quantity")


def funnel(events):
    stage = (
        F.when(F.col("topic") == TOPIC_CLICKSTREAM, F.col("action"))
        .when(F.col("topic") == TOPIC_ORDER_CREATED, F.lit("order_placed"))
        .when(F.col("topic") == TOPIC_ORDER_PAID, F.lit("payment_completed"))
    )
    aggregated = (
        events.withColumn("stage", stage)
        .where(F.col("stage").isNotNull())
        .withWatermark("event_time", WATERMARK)
        .groupBy(F.window("event_time", WINDOW), "stage")
        .agg(F.count("*").alias("events"))
    )
    return to_kafka_record(aggregated, "funnel", "stage", "stage", "events")


# ------------------------------------------------------------------------- sinks


def start_metric_query(records, name, brokers, checkpoints, trigger):
    return (
        records.writeStream.queryName(name)
        .format("kafka")
        .option("kafka.bootstrap.servers", brokers)
        .option("topic", TOPIC_ANALYTICS_REALTIME)
        .option("checkpointLocation", join_path(checkpoints, name))
        .outputMode("update")
        .trigger(processingTime=trigger)
        .start()
    )


def start_bronze_query(bronze, lake, checkpoints, trigger):
    return (
        bronze.writeStream.queryName("bronze_events")
        .format("parquet")
        .option("path", join_path(lake, "bronze", "events"))
        .option("checkpointLocation", join_path(checkpoints, "bronze_events"))
        .partitionBy("topic", "event_date")
        .outputMode("append")
        .trigger(processingTime=trigger)
        .start()
    )


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Foodex Spark Structured Streaming job")
    parser.add_argument("--brokers", default=os.environ.get("KAFKA_BROKERS", "localhost:9092"))
    parser.add_argument("--lake", required=True, help="Data lake root (bronze events are written here)")
    parser.add_argument("--checkpoints", required=True, help="Checkpoint directory (offsets and window state)")
    parser.add_argument("--starting-offsets", default="latest", choices=["latest", "earliest"])
    parser.add_argument("--metrics-trigger", default="5 seconds", help="Micro-batch interval for the metric queries")
    parser.add_argument("--lake-trigger", default="30 seconds", help="Micro-batch interval for the lake ingest")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    spark = build_spark("foodex-streaming-pipeline")
    spark.sparkContext.setLogLevel("WARN")

    kafka_df = read_kafka(spark, args.brokers, args.starting_offsets)
    events = parse_events(kafka_df)

    queries = [
        start_metric_query(order_windows(events), "order_windows", args.brokers, args.checkpoints, args.metrics_trigger),
        start_metric_query(trending_items(events), "trending_items", args.brokers, args.checkpoints, args.metrics_trigger),
        start_metric_query(funnel(events), "funnel", args.brokers, args.checkpoints, args.metrics_trigger),
        start_bronze_query(to_bronze(kafka_df), args.lake, args.checkpoints, args.lake_trigger),
    ]

    print(f"Started {len(queries)} streaming queries against {args.brokers}: {[query.name for query in queries]}")
    spark.streams.awaitAnyTermination()


if __name__ == "__main__":
    main()
