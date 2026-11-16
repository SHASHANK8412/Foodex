"""Tests for the Spark batch job. Need PySpark and a JVM; skipped otherwise."""

import json
import os

import pytest

pytest.importorskip("pyspark")

import batch_features  # noqa: E402
from foodex_schemas import ORDER_SCHEMA  # noqa: E402


@pytest.fixture(scope="module")
def orders_path(tmp_path_factory, order_rows):
    directory = tmp_path_factory.mktemp("orders")
    with open(directory / "part-00000.jsonl", "w", encoding="utf-8") as handle:
        for order in order_rows:
            handle.write(json.dumps(order) + "\n")
    return str(directory)


@pytest.fixture(scope="module")
def orders(spark, orders_path):
    return batch_features.prepare_orders(batch_features.read_orders(spark, [orders_path])).cache()


def test_prepare_orders_drops_cancelled_duplicate_and_invalid_rows(spark):
    rows = [
        ("o1", "u1", "r1", "2026-06-01T07:00:00.000Z", "delivered", 100.0),
        ("o1", "u1", "r1", "2026-06-01T07:00:00.000Z", "delivered", 100.0),  # duplicate
        ("o2", "u1", "r1", "2026-06-01T07:00:00.000Z", "cancelled", 100.0),
        ("o3", None, "r1", "2026-06-01T07:00:00.000Z", "delivered", 100.0),  # no customer
        ("o4", "u2", "r1", "not-a-timestamp", "delivered", 100.0),
        ("o5", "u2", "r1", "2026-06-01T20:45:00.000Z", None, 100.0),  # status unknown: kept
    ]
    raw = spark.createDataFrame(
        [
            (order_id, user, restaurant, "R", "Pune", created, status, "paid", total, 1, [], None, None)
            for order_id, user, restaurant, created, status, total in rows
        ],
        schema=ORDER_SCHEMA,
    )

    prepared = {row["order_id"]: row for row in batch_features.prepare_orders(raw).collect()}

    assert sorted(prepared) == ["o1", "o5"]
    # 07:00 UTC is 12:30 in Asia/Kolkata; 20:45 UTC is 02:15 the next day.
    assert prepared["o1"]["hour_of_day"] == 12
    assert prepared["o5"]["hour_of_day"] == 2
    assert str(prepared["o5"]["order_date"]) == "2026-06-02"


def test_restaurant_kpis_add_up_to_the_order_totals(orders):
    kpis = batch_features.build_restaurant_kpis(orders).collect()

    assert sum(row["orders"] for row in kpis) == orders.count()
    assert all(row["avgOrderValue"] > 0 and row["uniqueCustomers"] >= 1 for row in kpis)


def test_demand_forecast_is_an_average_per_active_day(orders):
    forecast = batch_features.build_demand_forecast(orders).collect()

    assert all(0 <= row["hour_of_day"] <= 23 for row in forecast)
    assert all(0 < row["expected_orders"] <= row["observed_orders"] for row in forecast)


def test_top_items_are_ranked_by_quantity(orders):
    items = batch_features.build_top_items(orders, limit=10).collect()
    quantities = [row["quantity"] for row in items]

    assert len(items) == 10
    assert quantities == sorted(quantities, reverse=True)


def test_als_recommends_ranked_restaurants_for_each_customer(orders):
    recommendations, metrics = batch_features.build_recommendations(orders, top_k=5)
    rows = recommendations.collect()
    known_restaurants = {row["restaurant_id"] for row in orders.select("restaurant_id").distinct().collect()}
    customers = orders.select("user_id").distinct().count()

    assert metrics["model"] == "als_implicit"
    assert {row["source"] for row in rows} == {"spark_als"}
    assert {row["userId"] for row in rows} and len({row["userId"] for row in rows}) == customers
    assert all(1 <= row["rank"] <= 5 for row in rows)
    assert {row["restaurantId"] for row in rows} <= known_restaurants


def test_recommendations_fall_back_to_popularity_on_tiny_data(orders):
    tiny = orders.limit(20)
    recommendations, metrics = batch_features.build_recommendations(tiny, top_k=3)

    assert metrics["model"] == "popularity"
    assert {row["source"] for row in recommendations.collect()} == {"spark_popularity"}


def test_eta_model_learns_that_distance_adds_delivery_time(orders):
    model = batch_features.train_eta_model(orders)

    # The generator adds 3.2 minutes per km and 1.1 per item.
    assert model["distanceKmCoeff"] == pytest.approx(3.2, abs=0.4)
    assert model["itemCountCoeff"] == pytest.approx(1.1, abs=0.5)
    # Rush hours and per-restaurant prep time are not linear in the features,
    # so the model explains a good part of the variance, not all of it.
    assert model["r2"] > 0.4
    assert model["trainRows"] > model["testRows"] > 0


def test_eta_model_is_skipped_without_enough_delivered_orders(orders):
    assert batch_features.train_eta_model(orders.limit(50)) is None


def test_customer_segments_cover_every_customer_once(spark, orders):
    summary, user_segments, metrics = batch_features.build_customer_segments(spark, orders, k=4)
    segments = summary.collect()
    customers = orders.select("user_id").distinct().count()

    # K-Means can return fewer than k clusters; names follow average spend, highest first.
    names = [row["segment"] for row in sorted(segments, key=lambda row: -row["avgSpend"])]
    assert len(names) >= 2 and names == batch_features.SEGMENT_NAMES[: len(names)]
    assert sum(row["customers"] for row in segments) == customers
    assert user_segments.count() == customers
    assert sum(row["share"] for row in segments) == pytest.approx(1.0, abs=0.01)
    assert -1 <= metrics["silhouette"] <= 1


def test_basket_rules_find_the_companion_dishes(orders):
    rules, _ = batch_features.build_basket_rules(orders, min_support=0.002, limit=5000)
    rows = rules.collect()
    pairs = {(tuple(row["antecedent"]), tuple(row["consequent"])) for row in rows}

    assert rows and all(row["lift"] > 1 for row in rows[:10])
    assert (("Butter Chicken",), ("Butter Naan",)) in pairs or (("Butter Naan",), ("Butter Chicken",)) in pairs


def test_orders_can_be_rebuilt_from_bronze_kafka_events(spark, tmp_path):
    created = {
        "eventId": "e1",
        "eventType": "foodex.order.created",
        "occurredAt": "2026-06-01T07:00:00.000Z",
        "orderId": "o1",
        "userId": "u1",
        "restaurantId": "r1",
        "restaurantName": "Dragon Bowl",
        "city": "Pune",
        "totalAmount": 250.5,
        "itemCount": 2,
        "items": [{"menuItemId": "m1", "name": "Spring Rolls", "quantity": 2, "price": 100}],
        "paymentStatus": "pending",
    }
    delivered = {"eventId": "e2", "orderId": "o1", "status": "delivered", "deliveryMinutes": 31.5}
    events = [
        ("foodex.order.created", json.dumps(created)),
        ("foodex.order.created", json.dumps(created)),  # redelivered by Kafka
        ("foodex.order.status", json.dumps({"eventId": "e3", "orderId": "o1", "status": "preparing"})),
        ("foodex.order.status", json.dumps(delivered)),
        ("foodex.clickstream", json.dumps({"eventId": "e4", "action": "page_view"})),
    ]
    lake = str(tmp_path / "lake")
    spark.createDataFrame(events, ["topic", "json"]).write.parquet(os.path.join(lake, "bronze", "events"))

    rows = batch_features.orders_from_lake_events(spark, lake).collect()

    assert len(rows) == 1
    assert rows[0]["order_id"] == "o1" and rows[0]["status"] == "delivered"
    assert rows[0]["delivery_minutes"] == 31.5
    assert rows[0]["items"][0]["menu_item_id"] == "m1"


def test_job_writes_every_dataset_and_a_manifest(spark, orders_path, tmp_path):
    output, lake = str(tmp_path / "output"), str(tmp_path / "lake")

    batch_features.main(
        ["--input", orders_path, "--output", output, "--lake", lake, "--dataset-label", "test"], spark=spark
    )

    with open(os.path.join(output, "_manifest.json"), encoding="utf-8") as handle:
        manifest = json.load(handle)

    expected = {
        "restaurant_kpis",
        "demand_forecast",
        "hourly_heatmap",
        "top_items",
        "recommendations",
        "delivery_eta_model",
        "customer_segments",
        "user_segments",
        "basket_rules",
    }
    assert set(manifest["datasets"]) == expected
    assert manifest["datasetLabel"] == "test"
    assert manifest["counts"]["orders"] > 5000
    assert manifest["metrics"]["deliveryEta"]["r2"] > 0.4

    for name in expected:
        parts = [file for file in os.listdir(os.path.join(output, name)) if file.startswith("part-")]
        assert len(parts) == 1 and parts[0].endswith(".json"), name
        with open(os.path.join(output, name, parts[0]), encoding="utf-8") as handle:
            assert json.loads(handle.readline()), name

    assert os.path.isdir(os.path.join(lake, "silver", "orders"))
