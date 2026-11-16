"""Tests for the synthetic data generator. Pure Python: no Spark or Java needed."""

import collections
import json
import random
from datetime import date

from generate_orders import (
    build_restaurants,
    build_users,
    generate_orders,
    guess_cuisine,
    load_catalog,
    write_orders,
)

ORDER_FIELDS = {
    "order_id",
    "user_id",
    "restaurant_id",
    "restaurant_name",
    "city",
    "created_at",
    "status",
    "payment_status",
    "total_amount",
    "item_count",
    "items",
    "distance_km",
    "delivery_minutes",
}


def make_world(seed=1, synthetic=12, users=200, catalog=None):
    rng = random.Random(seed)
    catalog = catalog or {"restaurants": [], "userIds": []}
    restaurants = build_restaurants(rng, catalog, synthetic)
    return restaurants, build_users(rng, catalog, users, restaurants)


def test_orders_match_the_schema_the_spark_job_reads(order_rows):
    for order in order_rows[:500]:
        assert set(order) == ORDER_FIELDS
        assert len(order["order_id"]) == 24
        assert order["created_at"].endswith("Z")
        assert isinstance(order["item_count"], int)
        assert order["items"], "an order always has at least one line"
        for line in order["items"]:
            assert set(line) == {"menu_item_id", "name", "quantity", "price"}
            assert isinstance(line["quantity"], int) and line["quantity"] >= 1


def test_totals_are_consistent_with_the_order_lines(order_rows):
    for order in order_rows[:500]:
        subtotal = sum(line["price"] * line["quantity"] for line in order["items"])
        assert order["item_count"] == sum(line["quantity"] for line in order["items"])
        assert order["total_amount"] == round(subtotal * 1.05 + 40, 2)


def test_only_delivered_orders_have_a_delivery_time(order_rows):
    for order in order_rows:
        if order["status"] == "delivered":
            assert order["delivery_minutes"] >= 8
        else:
            assert order["delivery_minutes"] is None


def test_generation_is_deterministic_for_a_seed():
    restaurants, users = make_world()
    end = date(2026, 6, 30)
    first = list(generate_orders(200, users, restaurants, days=30, seed=5, end_date=end))
    second = list(generate_orders(200, users, restaurants, days=30, seed=5, end_date=end))
    different = list(generate_orders(200, users, restaurants, days=30, seed=6, end_date=end))

    assert first == second
    assert first != different


def test_delivery_time_grows_with_distance(order_rows):
    delivered = [order for order in order_rows if order["status"] == "delivered"]
    near = [order["delivery_minutes"] for order in delivered if order["distance_km"] < 2]
    far = [order["delivery_minutes"] for order in delivered if order["distance_km"] > 6]

    assert near and far
    assert sum(far) / len(far) > sum(near) / len(near) + 8


def test_companion_dishes_are_ordered_together_more_than_chance(order_rows):
    total = len(order_rows)
    baskets = [{line["name"] for line in order["items"]} for order in order_rows]
    with_main = sum(1 for basket in baskets if "Butter Chicken" in basket)
    with_side = sum(1 for basket in baskets if "Butter Naan" in basket)
    with_both = sum(1 for basket in baskets if {"Butter Chicken", "Butter Naan"} <= basket)

    lift = (with_both / total) / ((with_main / total) * (with_side / total))
    assert lift > 3


def test_customer_activity_is_heavy_tailed(order_rows):
    per_customer = sorted(collections.Counter(order["user_id"] for order in order_rows).values())
    median = per_customer[len(per_customer) // 2]
    assert per_customer[-1] > 5 * median


def test_orders_peak_at_lunch_and_dinner(order_rows):
    def local_hour(order):
        hours, minutes = int(order["created_at"][11:13]), int(order["created_at"][14:16])
        return ((hours * 60 + minutes + 330) // 60) % 24

    by_hour = collections.Counter(local_hour(order) for order in order_rows)
    assert by_hour[13] > 4 * by_hour[4]
    assert by_hour[20] > 4 * by_hour[4]


def test_real_catalogue_restaurants_and_customers_are_used(tmp_path):
    catalog_file = tmp_path / "catalog.json"
    catalog_file.write_text(
        json.dumps(
            {
                "restaurants": [
                    {
                        "id": "a" * 24,
                        "name": "Urban Spice Kitchen",
                        "city": "Bengaluru",
                        "menu": [
                            {"id": "b" * 24, "name": "Butter Chicken", "price": 299},
                            {"id": "c" * 24, "name": "Dal Makhani", "price": 199},
                        ],
                    },
                    {"id": "d" * 24, "name": "Empty Kitchen", "city": "Pune", "menu": []},
                ],
                "userIds": ["e" * 24],
            }
        ),
        encoding="utf-8",
    )

    catalog = load_catalog(str(catalog_file))
    assert [restaurant["name"] for restaurant in catalog["restaurants"]] == ["Urban Spice Kitchen"]

    restaurants, users = make_world(catalog=catalog, synthetic=6, users=50)
    orders = list(generate_orders(3000, users, restaurants, days=30, seed=3))

    assert users[0]["id"] == "e" * 24 and users[0]["city"] == "Bengaluru"
    assert any(order["restaurant_id"] == "a" * 24 for order in orders)
    assert any(order["user_id"] == "e" * 24 for order in orders)


def test_guess_cuisine_matches_menu_vocabulary():
    assert guess_cuisine(["Butter Chicken", "Dal Makhani"]) == "North Indian"
    assert guess_cuisine(["Veg Hakka Noodles"]) == "Chinese"
    assert guess_cuisine(["Something Unknown"]) is None


def test_write_orders_splits_into_part_files_and_replaces_old_ones(tmp_path, order_rows):
    out = tmp_path / "synthetic"
    out.mkdir()
    (out / "part-00099.jsonl").write_text("stale\n", encoding="utf-8")

    rows, files, size = write_orders(iter(order_rows[:250]), str(out), part_size=100)

    names = sorted(path.name for path in out.iterdir())
    assert (rows, files) == (250, 3)
    assert names == ["part-00000.jsonl", "part-00001.jsonl", "part-00002.jsonl"]
    assert size == sum(path.stat().st_size for path in out.iterdir())

    first_file = (out / "part-00000.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(first_file) == 100
    assert json.loads(first_file[0]) == order_rows[0]
