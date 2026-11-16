"""Tests for the streaming transformations.

The transformations are ordinary DataFrame functions, so they are exercised
here on static data shaped like the Kafka source. Need PySpark and a JVM.
"""

import json
from datetime import datetime

import pytest

pytest.importorskip("pyspark")

from pyspark.sql.types import (  # noqa: E402
    BinaryType,
    IntegerType,
    LongType,
    StringType,
    StructField,
    StructType,
    TimestampType,
)

import streaming_pipeline  # noqa: E402

KAFKA_SCHEMA = StructType(
    [
        StructField("key", BinaryType()),
        StructField("value", BinaryType()),
        StructField("topic", StringType()),
        StructField("partition", IntegerType()),
        StructField("offset", LongType()),
        StructField("timestamp", TimestampType()),
    ]
)

BROKER_TIME = datetime(2026, 6, 1, 12, 30, 0)


def kafka_frame(spark, messages):
    rows = [
        (b"k", value if isinstance(value, bytes) else json.dumps(value).encode("utf-8"), topic, 0, offset, BROKER_TIME)
        for offset, (topic, value) in enumerate(messages)
    ]
    return spark.createDataFrame(rows, schema=KAFKA_SCHEMA)


def order(restaurant, amount, at, items=None, name="Dragon Bowl"):
    return (
        "foodex.order.created",
        {
            "eventId": f"{restaurant}-{amount}-{at}",
            "occurredAt": at,
            "orderId": f"o-{amount}",
            "restaurantId": restaurant,
            "restaurantName": name,
            "totalAmount": amount,
            "items": items or [],
        },
    )


def values(dataframe):
    return [json.loads(row["value"]) for row in dataframe.collect()]


def test_parse_events_uses_producer_time_and_falls_back_to_broker_time(spark):
    frame = kafka_frame(
        spark,
        [
            ("foodex.clickstream", {"action": "page_view", "occurredAt": "2026-06-01T10:15:30.000Z"}),
            ("foodex.clickstream", {"action": "page_view"}),
            ("foodex.clickstream", b"{not json"),
        ],
    )

    times = sorted(str(row["event_time"]) for row in streaming_pipeline.parse_events(frame).collect())

    assert times == ["2026-06-01 10:15:30", "2026-06-01 12:30:00"]


def test_order_windows_aggregate_per_restaurant_per_minute(spark):
    frame = kafka_frame(
        spark,
        [
            order("r1", 100.0, "2026-06-01T10:15:05.000Z"),
            order("r1", 250.5, "2026-06-01T10:15:55.000Z"),
            order("r1", 80.0, "2026-06-01T10:16:10.000Z"),
            order("r2", 40.0, "2026-06-01T10:15:20.000Z", name="Pasta Street"),
            ("foodex.order.paid", {"orderId": "o-100", "occurredAt": "2026-06-01T10:15:30.000Z"}),
        ],
    )

    records = values(streaming_pipeline.order_windows(streaming_pipeline.parse_events(frame)))
    by_key = {(record["restaurantId"], record["windowStart"]): record for record in records}

    assert len(records) == 3
    first = by_key[("r1", "2026-06-01T10:15:00.000Z")]
    assert first["metric"] == "order_window"
    assert (first["orders"], first["revenue"]) == (2, 350.5)
    assert first["windowEnd"] == "2026-06-01T10:16:00.000Z"
    assert by_key[("r1", "2026-06-01T10:16:00.000Z")]["orders"] == 1
    assert by_key[("r2", "2026-06-01T10:15:00.000Z")]["restaurantName"] == "Pasta Street"


def test_trending_items_sum_quantities_across_orders(spark):
    frame = kafka_frame(
        spark,
        [
            order("r1", 1.0, "2026-06-01T10:15:05.000Z", [{"name": "Spring Rolls", "quantity": 2}]),
            order(
                "r2",
                2.0,
                "2026-06-01T10:15:40.000Z",
                [{"name": "Spring Rolls", "quantity": 1}, {"name": "Cola", "quantity": 3}],
            ),
        ],
    )

    records = values(streaming_pipeline.trending_items(streaming_pipeline.parse_events(frame)))

    assert {record["itemName"]: record["quantity"] for record in records} == {"Spring Rolls": 3, "Cola": 3}
    assert {record["metric"] for record in records} == {"trending_item"}


def test_funnel_maps_topics_to_stages(spark):
    at = "2026-06-01T10:15:05.000Z"
    frame = kafka_frame(
        spark,
        [
            ("foodex.clickstream", {"action": "page_view", "occurredAt": at}),
            ("foodex.clickstream", {"action": "page_view", "occurredAt": at}),
            ("foodex.clickstream", {"action": "add_to_cart", "occurredAt": at}),
            order("r1", 10.0, at),
            ("foodex.order.paid", {"orderId": "o1", "occurredAt": at}),
            ("foodex.delivery.assigned", {"orderId": "o1", "occurredAt": at}),
        ],
    )

    records = values(streaming_pipeline.funnel(streaming_pipeline.parse_events(frame)))

    assert {record["stage"]: record["events"] for record in records} == {
        "page_view": 2,
        "add_to_cart": 1,
        "order_placed": 1,
        "payment_completed": 1,
    }


def test_bronze_keeps_the_raw_payload_and_its_origin(spark):
    frame = kafka_frame(spark, [("foodex.clickstream", {"action": "page_view"})])

    row = streaming_pipeline.to_bronze(frame).collect()[0]

    assert (row["topic"], row["partition"], row["offset"], row["key"]) == ("foodex.clickstream", 0, 0, "k")
    assert json.loads(row["json"]) == {"action": "page_view"}
    assert str(row["event_date"]) == "2026-06-01"
