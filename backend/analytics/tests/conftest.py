import os
import sys
import time

import pytest

# Spark hands timestamps to Python in the process time zone; pin it so the
# tests read the same values everywhere.
os.environ["TZ"] = "UTC"
if hasattr(time, "tzset"):
    time.tzset()

# The jobs are plain scripts in the parent directory; make them importable.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture(scope="session")
def spark():
    """A small local SparkSession shared by the Spark tests.

    Skips those tests when PySpark (or a JVM) is not available, so the
    pure-Python tests still run anywhere.
    """
    pyspark_sql = pytest.importorskip("pyspark.sql")

    try:
        session = (
            pyspark_sql.SparkSession.builder.master("local[2]")
            .appName("foodex-analytics-tests")
            .config("spark.ui.enabled", "false")
            .config("spark.sql.shuffle.partitions", "2")
            .config("spark.sql.session.timeZone", "UTC")
            .getOrCreate()
        )
    except Exception as error:  # no Java runtime, for example
        pytest.skip(f"Spark could not start: {error}")

    yield session
    session.stop()


@pytest.fixture(scope="session")
def order_rows():
    """A few thousand generated orders, shared across tests."""
    import random

    from generate_orders import build_restaurants, build_users, generate_orders

    rng = random.Random(7)
    catalog = {"restaurants": [], "userIds": []}
    restaurants = build_restaurants(rng, catalog, synthetic_count=12)
    users = build_users(rng, catalog, user_count=300, restaurants=restaurants)
    return list(generate_orders(6000, users, restaurants, days=60, seed=11))
