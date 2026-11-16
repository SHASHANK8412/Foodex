"""Foodex batch analytics job (PySpark + MLlib).

Reads order-level data, cleans it into a silver table and builds the gold
datasets the API serves:

    recommendations      ALS collaborative filtering on customer x restaurant orders
    customer_segments    RFM features clustered with K-Means
    basket_rules         FP-Growth association rules over order baskets
    delivery_eta_model   linear regression, exported as coefficients
    demand_forecast      expected orders per restaurant per hour of day
    restaurant_kpis, top_items, hourly_heatmap

Run locally (pip install -r requirements.txt, Java 17):

    python batch_features.py --input data/orders data/synthetic --output output \
        --lake lake --dataset-label synthetic

or on a cluster with spark-submit (see docker-compose.yml at the repo root).

Each dataset is written as <output>/<name>/part-*.json (JSON lines), which
backend/src/services/sparkOutputStore.js reads. Only DataFrame and MLlib APIs
are used, so no Python code has to run on the executors.
"""

import argparse
import functools
import json
import os
import sys
import time
from datetime import datetime, timezone

from pyspark.ml.clustering import KMeans
from pyspark.ml.evaluation import ClusteringEvaluator, RegressionEvaluator
from pyspark.ml.feature import StandardScaler, StringIndexer, VectorAssembler
from pyspark.ml.fpm import FPGrowth
from pyspark.ml.recommendation import ALS
from pyspark.ml.regression import LinearRegression
from pyspark.sql import Row, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window

from foodex_schemas import EVENT_SCHEMA, ORDER_SCHEMA, TOPIC_ORDER_CREATED, TOPIC_ORDER_STATUS

SEGMENT_NAMES = ["High value", "Regulars", "Occasional", "Low activity"]


def build_spark(app_name):
    return (
        SparkSession.builder.appName(app_name)
        # Timestamps in the data are UTC; local time is derived explicitly.
        .config("spark.sql.session.timeZone", "UTC")
        .config("spark.sql.shuffle.partitions", os.environ.get("SPARK_SHUFFLE_PARTITIONS", "8"))
        .getOrCreate()
    )


def join_path(base, *parts):
    return "/".join([base.rstrip("/\\")] + list(parts))


def is_local_path(path):
    return "://" not in path


# --------------------------------------------------------------------------- input


def read_orders(spark, paths, fmt="json"):
    reader = spark.read.schema(ORDER_SCHEMA)
    return reader.parquet(*paths) if fmt == "parquet" else reader.json(list(paths))


def orders_from_lake_events(spark, lake):
    """Rebuilds orders from the raw Kafka events the streaming job stored in bronze."""
    events = spark.read.parquet(join_path(lake, "bronze", "events"))

    def parsed(topic):
        return (
            events.where(F.col("topic") == topic)
            .select(F.from_json(F.col("json"), EVENT_SCHEMA).alias("e"))
            .select("e.*")
            .where(F.col("orderId").isNotNull())
        )

    created = parsed(TOPIC_ORDER_CREATED).dropDuplicates(["orderId"]).select(
        F.col("orderId").alias("order_id"),
        F.col("userId").alias("user_id"),
        F.col("restaurantId").alias("restaurant_id"),
        F.col("restaurantName").alias("restaurant_name"),
        "city",
        F.col("occurredAt").alias("created_at"),
        F.col("paymentStatus").alias("payment_status"),
        F.col("totalAmount").alias("total_amount"),
        F.col("itemCount").alias("item_count"),
        F.expr(
            "transform(items, x -> named_struct("
            "'menu_item_id', x.menuItemId, 'name', x.name, 'quantity', x.quantity, 'price', x.price))"
        ).alias("items"),
    )

    delivered = (
        parsed(TOPIC_ORDER_STATUS)
        .where(F.col("status") == "delivered")
        .dropDuplicates(["orderId"])
        .select(
            F.col("orderId").alias("order_id"),
            F.col("status").alias("final_status"),
            F.col("deliveryMinutes").alias("delivery_minutes"),
        )
    )

    return created.join(delivered, "order_id", "left").select(
        "order_id",
        "user_id",
        "restaurant_id",
        "restaurant_name",
        "city",
        "created_at",
        F.coalesce(F.col("final_status"), F.lit("pending")).alias("status"),
        "payment_status",
        "total_amount",
        "item_count",
        "items",
        F.lit(None).cast("double").alias("distance_km"),
        "delivery_minutes",
    )


def prepare_orders(raw, tz="Asia/Kolkata"):
    """Silver: valid, de-duplicated, non-cancelled orders with local-time columns."""
    return (
        raw.where(
            F.col("order_id").isNotNull()
            & F.col("user_id").isNotNull()
            & F.col("restaurant_id").isNotNull()
            & F.col("total_amount").isNotNull()
        )
        .where(F.coalesce(F.col("status"), F.lit("")) != "cancelled")
        .dropDuplicates(["order_id"])
        .withColumn("created_ts", F.to_timestamp("created_at"))
        .where(F.col("created_ts").isNotNull())
        .withColumn("local_ts", F.from_utc_timestamp("created_ts", tz))
        .withColumn("order_date", F.to_date("local_ts"))
        .withColumn("hour_of_day", F.hour("local_ts"))
        .withColumn("day_of_week", F.dayofweek("local_ts"))
        .drop("local_ts")
    )


# ------------------------------------------------------------------------ features


def build_restaurant_kpis(orders):
    return orders.groupBy(F.col("restaurant_id").alias("restaurantId")).agg(
        F.first("restaurant_name", ignorenulls=True).alias("restaurantName"),
        F.first("city", ignorenulls=True).alias("city"),
        F.count("*").alias("orders"),
        F.round(F.sum("total_amount"), 2).alias("revenue"),
        F.round(F.avg("total_amount"), 2).alias("avgOrderValue"),
        F.countDistinct("user_id").alias("uniqueCustomers"),
        F.round(F.avg("delivery_minutes"), 1).alias("avgDeliveryMinutes"),
    )


def build_demand_forecast(orders):
    """Expected orders per restaurant for each hour of day: the average over the
    days the restaurant was active, rather than a raw count."""
    active_days = orders.groupBy("restaurant_id").agg(F.countDistinct("order_date").alias("active_days"))
    hourly = orders.groupBy("restaurant_id", "hour_of_day").agg(F.count("*").alias("observed_orders"))

    return hourly.join(active_days, "restaurant_id").select(
        F.col("restaurant_id").alias("restaurantId"),
        "hour_of_day",
        F.round(F.col("observed_orders") / F.col("active_days"), 2).alias("expected_orders"),
        "observed_orders",
    )


def build_hourly_heatmap(orders):
    return orders.groupBy(F.col("day_of_week").alias("dayOfWeek"), F.col("hour_of_day").alias("hour")).agg(
        F.count("*").alias("orders")
    )


def build_top_items(orders, limit=50):
    lines = orders.select("order_id", F.explode("items").alias("item")).where(F.col("item.name").isNotNull())

    return (
        lines.groupBy(F.col("item.name").alias("itemName"))
        .agg(
            F.sum(F.col("item.quantity")).alias("quantity"),
            F.round(F.sum(F.col("item.price") * F.col("item.quantity")), 2).alias("revenue"),
            F.countDistinct("order_id").alias("orders"),
        )
        .orderBy(F.desc("quantity"))
        .limit(limit)
    )


def build_recommendations(orders, top_k=10, min_interactions=50):
    """Top restaurants per customer.

    ALS with implicit feedback: the number of orders a customer placed at a
    restaurant is the confidence that they like it. Falls back to each
    customer's own most-ordered restaurants when there is too little data to
    factorise. Returns (dataframe, metrics).
    """
    interactions = orders.groupBy("user_id", "restaurant_id").agg(F.count("*").cast("float").alias("strength"))
    stats = interactions.agg(
        F.count("*").alias("pairs"),
        F.countDistinct("user_id").alias("users"),
        F.countDistinct("restaurant_id").alias("restaurants"),
    ).first()

    if stats["pairs"] < min_interactions or stats["users"] < 2 or stats["restaurants"] < 2:
        ranked = interactions.withColumn(
            "rank", F.row_number().over(Window.partitionBy("user_id").orderBy(F.desc("strength")))
        ).where(F.col("rank") <= top_k)
        result = ranked.select(
            F.col("user_id").alias("userId"),
            F.col("restaurant_id").alias("restaurantId"),
            F.col("strength").cast("double").alias("score"),
            "rank",
            F.lit("spark_popularity").alias("source"),
        )
        return result, {"model": "popularity", "interactions": stats["pairs"]}

    # ALS needs integer ids.
    indexed = StringIndexer(inputCol="user_id", outputCol="user_idx").fit(interactions).transform(interactions)
    indexed = StringIndexer(inputCol="restaurant_id", outputCol="restaurant_idx").fit(indexed).transform(indexed)
    indexed = (
        indexed.withColumn("user_idx", F.col("user_idx").cast("int"))
        .withColumn("restaurant_idx", F.col("restaurant_idx").cast("int"))
        .cache()
    )

    params = {"rank": 16, "maxIter": 10, "regParam": 0.08, "alpha": 20.0}
    model = ALS(
        userCol="user_idx",
        itemCol="restaurant_idx",
        ratingCol="strength",
        implicitPrefs=True,
        nonnegative=True,
        coldStartStrategy="drop",
        seed=42,
        **params,
    ).fit(indexed)

    exploded = model.recommendForAllUsers(top_k).select(
        "user_idx", F.posexplode("recommendations").alias("position", "recommendation")
    )
    users = indexed.select("user_idx", "user_id").distinct()
    restaurants = indexed.select("restaurant_idx", "restaurant_id").distinct()

    result = (
        exploded.select(
            "user_idx",
            (F.col("position") + 1).alias("rank"),
            F.col("recommendation.restaurant_idx").alias("restaurant_idx"),
            F.col("recommendation.rating").cast("double").alias("score"),
        )
        .join(users, "user_idx")
        .join(F.broadcast(restaurants), "restaurant_idx")
        .select(
            F.col("user_id").alias("userId"),
            F.col("restaurant_id").alias("restaurantId"),
            F.round("score", 4).alias("score"),
            "rank",
            F.lit("spark_als").alias("source"),
        )
    )

    metrics = {
        "model": "als_implicit",
        "interactions": stats["pairs"],
        "users": stats["users"],
        "restaurants": stats["restaurants"],
        "topK": top_k,
        **params,
    }
    return result, metrics


def train_eta_model(orders, min_rows=200):
    """Linear regression for delivery minutes, evaluated on a held-out 20%.

    A linear model is used on purpose: its coefficients are exported so the
    Node API can score a request without a Spark runtime. Returns a dict, or
    None when there are too few delivered orders with a distance to learn from.
    """
    data = orders.where(
        F.col("delivery_minutes").isNotNull()
        & F.col("distance_km").isNotNull()
        & F.col("item_count").isNotNull()
        & F.col("delivery_minutes").between(1, 240)
        & F.col("distance_km").between(0, 60)
    ).select(
        "distance_km",
        F.col("item_count").cast("double").alias("item_count"),
        F.col("hour_of_day").cast("double").alias("hour_of_day"),
        F.col("delivery_minutes").alias("label"),
    )

    if data.count() < min_rows:
        return None

    features = ["distance_km", "item_count", "hour_of_day"]
    dataset = VectorAssembler(inputCols=features, outputCol="features").transform(data).select("features", "label")
    train, test = dataset.randomSplit([0.8, 0.2], seed=42)
    train.cache()

    model = LinearRegression(maxIter=50, regParam=0.01, elasticNetParam=0.0).fit(train)
    predictions = model.transform(test).cache()
    evaluator = RegressionEvaluator(labelCol="label", predictionCol="prediction")
    coefficients = [float(value) for value in model.coefficients]

    return {
        "model": "linear_regression",
        "intercept": float(model.intercept),
        "distanceKmCoeff": coefficients[0],
        "itemCountCoeff": coefficients[1],
        "hourCoeff": coefficients[2],
        "rmse": float(evaluator.evaluate(predictions, {evaluator.metricName: "rmse"})),
        "mae": float(evaluator.evaluate(predictions, {evaluator.metricName: "mae"})),
        "r2": float(evaluator.evaluate(predictions, {evaluator.metricName: "r2"})),
        "trainRows": train.count(),
        "testRows": predictions.count(),
    }


def build_customer_segments(spark, orders, k=4, min_customers=40):
    """RFM (recency, frequency, monetary) per customer, clustered with K-Means.

    Returns (segment summary, customer -> segment, metrics), or None when there
    are too few customers to cluster.
    """
    reference_date = orders.agg(F.max("order_date")).first()[0]
    rfm = orders.groupBy("user_id").agg(
        F.datediff(F.lit(reference_date), F.max("order_date")).alias("recency_days"),
        F.count("*").alias("frequency"),
        F.sum("total_amount").alias("monetary"),
    )

    customers = rfm.count()
    if customers < max(min_customers, k):
        return None

    # Order counts and spend are heavy-tailed, so they are log-scaled before
    # standardising; otherwise a handful of heavy users dominate the distances.
    prepared = rfm.select(
        "user_id",
        "recency_days",
        "frequency",
        "monetary",
        F.col("recency_days").cast("double").alias("r"),
        F.log1p(F.col("frequency").cast("double")).alias("f"),
        F.log1p(F.col("monetary")).alias("m"),
    )
    assembled = VectorAssembler(inputCols=["r", "f", "m"], outputCol="raw_features").transform(prepared)
    scaled = (
        StandardScaler(inputCol="raw_features", outputCol="features", withMean=True, withStd=True)
        .fit(assembled)
        .transform(assembled)
        .cache()
    )

    clustered = KMeans(k=k, seed=42, featuresCol="features", predictionCol="cluster").fit(scaled).transform(scaled)
    silhouette = ClusteringEvaluator(featuresCol="features", predictionCol="cluster").evaluate(clustered)

    clusters = (
        clustered.groupBy("cluster")
        .agg(
            F.count("*").alias("customers"),
            F.avg("recency_days").alias("recency"),
            F.avg("frequency").alias("orders"),
            F.avg("monetary").alias("spend"),
        )
        .orderBy(F.desc("spend"))
        .collect()
    )

    # Clusters are named by average spend, highest first.
    summary_rows, name_rows = [], []
    for position, cluster in enumerate(clusters):
        name = SEGMENT_NAMES[position] if position < len(SEGMENT_NAMES) else f"Segment {position + 1}"
        name_rows.append(Row(cluster=int(cluster["cluster"]), segment=name))
        summary_rows.append(
            Row(
                segment=name,
                cluster=int(cluster["cluster"]),
                customers=int(cluster["customers"]),
                share=round(cluster["customers"] / customers, 4),
                avgRecencyDays=round(float(cluster["recency"]), 1),
                avgOrders=round(float(cluster["orders"]), 2),
                avgSpend=round(float(cluster["spend"]), 2),
            )
        )

    user_segments = clustered.select(F.col("user_id").alias("userId"), "cluster").join(
        F.broadcast(spark.createDataFrame(name_rows)), "cluster"
    )
    metrics = {"model": "kmeans_rfm", "k": k, "customers": customers, "silhouette": round(float(silhouette), 4)}
    return spark.createDataFrame(summary_rows), user_segments, metrics


def build_basket_rules(orders, min_support=0.002, min_confidence=0.2, limit=100):
    """Dishes that are ordered together: FP-Growth association rules.

    Returns (rules, metrics). `lift` > 1 means the consequent is ordered more
    often with the antecedent than on its own.
    """
    baskets = orders.select(
        F.expr("array_distinct(filter(items.name, x -> x is not null))").alias("basket")
    ).where(F.size("basket") > 0)

    model = FPGrowth(itemsCol="basket", minSupport=min_support, minConfidence=min_confidence).fit(baskets)

    rules = (
        model.associationRules.where(F.size("antecedent") <= 2)
        .orderBy(F.desc("lift"), F.desc("confidence"))
        .limit(limit)
        .select(
            "antecedent",
            "consequent",
            F.round("confidence", 4).alias("confidence"),
            F.round("lift", 4).alias("lift"),
            F.round("support", 5).alias("support"),
        )
    )
    metrics = {"model": "fp_growth", "minSupport": min_support, "minConfidence": min_confidence}
    return rules, metrics


# ------------------------------------------------------------------------- output


def write_dataset(dataframe, output, name):
    # coalesce(1): the gold datasets are small, and one part file is easy to serve.
    dataframe.coalesce(1).write.mode("overwrite").json(join_path(output, name))


def write_manifest(output, manifest):
    if not is_local_path(output):
        print(f"[manifest] {output} is not a local path; skipping _manifest.json")
        return
    os.makedirs(output, exist_ok=True)
    with open(os.path.join(output, "_manifest.json"), "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Build Foodex gold datasets with Spark")
    parser.add_argument("--input", nargs="*", default=[], help="Order datasets (files or directories)")
    parser.add_argument("--format", default="json", choices=["json", "parquet"], help="Format of --input")
    parser.add_argument("--output", required=True, help="Directory for the gold datasets the API serves")
    parser.add_argument("--lake", default="", help="Data lake root; the silver orders table is written here")
    parser.add_argument(
        "--include-lake-events",
        action="store_true",
        help="Also rebuild orders from the Kafka events stored in <lake>/bronze/events",
    )
    parser.add_argument("--dataset-label", default="unspecified", help="Shown in the UI, e.g. production or synthetic")
    parser.add_argument("--timezone", default="Asia/Kolkata", help="Time zone for hour-of-day features")
    parser.add_argument("--top-k", type=int, default=10, help="Recommendations per customer")
    parser.add_argument("--segments", type=int, default=4, help="Number of customer segments (k)")
    parser.add_argument("--min-support", type=float, default=0.002, help="FP-Growth minimum support")
    return parser.parse_args(argv)


def main(argv=None, spark=None):
    args = parse_args(argv)
    started = time.time()

    # A caller (the tests) may pass its own session; only stop one created here.
    owns_session = spark is None
    spark = spark or build_spark("foodex-batch-features")
    spark.sparkContext.setLogLevel("WARN")

    def stop():
        if owns_session:
            spark.stop()

    inputs = [path for path in args.input if not is_local_path(path) or os.path.exists(path)]
    for missing in sorted(set(args.input) - set(inputs)):
        print(f"[input] skipping {missing}: not found")

    frames = []
    if inputs:
        frames.append(read_orders(spark, inputs, args.format))
    if args.include_lake_events and args.lake:
        bronze = join_path(args.lake, "bronze", "events")
        if not is_local_path(bronze) or os.path.isdir(bronze):
            frames.append(orders_from_lake_events(spark, args.lake))
        else:
            print(f"[input] skipping lake events: {bronze} not found")

    if not frames:
        stop()
        sys.exit("No input data found. Pass --input and/or --lake with --include-lake-events.")

    raw = functools.reduce(lambda left, right: left.unionByName(right), frames)
    orders = prepare_orders(raw, args.timezone).cache()

    counts = orders.agg(
        F.count("*").alias("orders"),
        F.countDistinct("user_id").alias("customers"),
        F.countDistinct("restaurant_id").alias("restaurants"),
    ).first()
    if counts["orders"] == 0:
        stop()
        sys.exit("The input contains no usable orders.")
    print(f"[silver] {counts['orders']:,} orders, {counts['customers']:,} customers, {counts['restaurants']:,} restaurants")

    stage_seconds, metrics, datasets = {}, {}, []

    def stage(name, action):
        stage_started = time.time()
        result = action()
        stage_seconds[name] = round(time.time() - stage_started, 2)
        print(f"[{name}] done in {stage_seconds[name]}s")
        return result

    def publish(name, dataframe):
        write_dataset(dataframe, args.output, name)
        datasets.append(name)

    if args.lake:
        stage(
            "silver_orders",
            lambda: orders.repartition("order_date")
            .write.mode("overwrite")
            .partitionBy("order_date")
            .parquet(join_path(args.lake, "silver", "orders")),
        )

    stage("restaurant_kpis", lambda: publish("restaurant_kpis", build_restaurant_kpis(orders)))
    stage("demand_forecast", lambda: publish("demand_forecast", build_demand_forecast(orders)))
    stage("hourly_heatmap", lambda: publish("hourly_heatmap", build_hourly_heatmap(orders)))
    stage("top_items", lambda: publish("top_items", build_top_items(orders)))

    def recommendations():
        dataframe, model_metrics = build_recommendations(orders, top_k=args.top_k)
        publish("recommendations", dataframe)
        metrics["recommendations"] = model_metrics

    stage("recommendations", recommendations)

    def eta_model():
        model = train_eta_model(orders)
        if model is None:
            print("[delivery_eta_model] not enough delivered orders with a distance; skipped")
            return
        publish("delivery_eta_model", spark.createDataFrame([Row(**model)]))
        metrics["deliveryEta"] = {key: model[key] for key in ("rmse", "mae", "r2", "trainRows", "testRows")}

    stage("delivery_eta_model", eta_model)

    def segments():
        result = build_customer_segments(spark, orders, k=args.segments)
        if result is None:
            print("[customer_segments] not enough customers to cluster; skipped")
            return
        summary, user_segments, model_metrics = result
        publish("customer_segments", summary)
        publish("user_segments", user_segments)
        metrics["segments"] = model_metrics

    stage("customer_segments", segments)

    def basket_rules():
        rules, model_metrics = build_basket_rules(orders, min_support=args.min_support)
        publish("basket_rules", rules)
        metrics["basketRules"] = model_metrics

    stage("basket_rules", basket_rules)

    write_manifest(
        args.output,
        {
            "job": "batch_features",
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sparkVersion": spark.version,
            "master": spark.sparkContext.master,
            "datasetLabel": args.dataset_label,
            "inputPaths": inputs,
            "includedLakeEvents": bool(args.include_lake_events and args.lake),
            "timezone": args.timezone,
            "counts": {
                "orders": counts["orders"],
                "customers": counts["customers"],
                "restaurants": counts["restaurants"],
            },
            "metrics": metrics,
            "stageSeconds": stage_seconds,
            "durationSeconds": round(time.time() - started, 1),
            "datasets": datasets,
        },
    )

    print(f"Wrote {len(datasets)} datasets to {args.output} in {round(time.time() - started, 1)}s")
    orders.unpersist()
    stop()


if __name__ == "__main__":
    main()
