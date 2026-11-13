"""Schemas shared by the Spark jobs.

Explicit schemas keep the jobs independent of JSON schema inference, which would
otherwise depend on which optional fields happen to be present in a sample.
"""

from pyspark.sql.types import (
    ArrayType,
    BooleanType,
    DoubleType,
    IntegerType,
    StringType,
    StructField,
    StructType,
)

# One order per record. Written by `npm run analytics:export` (MongoDB) and by
# generate_orders.py (synthetic).
ORDER_SCHEMA = StructType(
    [
        StructField("order_id", StringType()),
        StructField("user_id", StringType()),
        StructField("restaurant_id", StringType()),
        StructField("restaurant_name", StringType()),
        StructField("city", StringType()),
        StructField("created_at", StringType()),
        StructField("status", StringType()),
        StructField("payment_status", StringType()),
        StructField("total_amount", DoubleType()),
        StructField("item_count", IntegerType()),
        StructField(
            "items",
            ArrayType(
                StructType(
                    [
                        StructField("menu_item_id", StringType()),
                        StructField("name", StringType()),
                        StructField("quantity", IntegerType()),
                        StructField("price", DoubleType()),
                    ]
                )
            ),
        ),
        StructField("distance_km", DoubleType()),
        StructField("delivery_minutes", DoubleType()),
    ]
)

# The value of every message on the foodex.* domain topics: the envelope built
# in backend/src/kafka/eventEnvelope.js with the payload fields at the top level.
# It is the union of the fields used by all event types; absent fields are null.
EVENT_SCHEMA = StructType(
    [
        StructField("eventId", StringType()),
        StructField("eventType", StringType()),
        StructField("schemaVersion", IntegerType()),
        StructField("occurredAt", StringType()),
        StructField("source", StringType()),
        StructField("synthetic", BooleanType()),
        # order events
        StructField("orderId", StringType()),
        StructField("userId", StringType()),
        StructField("restaurantId", StringType()),
        StructField("restaurantName", StringType()),
        StructField("city", StringType()),
        StructField("totalAmount", DoubleType()),
        StructField("itemCount", IntegerType()),
        StructField(
            "items",
            ArrayType(
                StructType(
                    [
                        StructField("menuItemId", StringType()),
                        StructField("name", StringType()),
                        StructField("quantity", IntegerType()),
                        StructField("price", DoubleType()),
                    ]
                )
            ),
        ),
        StructField("paymentStatus", StringType()),
        StructField("status", StringType()),
        StructField("deliveryMinutes", DoubleType()),
        StructField("deliveryPartnerId", StringType()),
        # clickstream events
        StructField("sessionId", StringType()),
        StructField("action", StringType()),
        StructField("path", StringType()),
        StructField("menuItemId", StringType()),
        StructField("query", StringType()),
    ]
)

TOPIC_ORDER_CREATED = "foodex.order.created"
TOPIC_ORDER_PAID = "foodex.order.paid"
TOPIC_ORDER_STATUS = "foodex.order.status"
TOPIC_DELIVERY_ASSIGNED = "foodex.delivery.assigned"
TOPIC_CLICKSTREAM = "foodex.clickstream"
TOPIC_ANALYTICS_REALTIME = "foodex.analytics.realtime"

# Topics the streaming job reads. The realtime topic is its output, not an input.
SOURCE_TOPICS = [
    TOPIC_ORDER_CREATED,
    TOPIC_ORDER_PAID,
    TOPIC_ORDER_STATUS,
    TOPIC_DELIVERY_ASSIGNED,
    TOPIC_CLICKSTREAM,
]
