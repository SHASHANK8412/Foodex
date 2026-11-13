"""Synthetic order generator for the Foodex analytics pipeline.

Produces order-level JSON lines in the schema read by batch_features.py, at
whatever volume is asked for, so the Spark jobs can be exercised on far more
data than a demo database holds.

    python generate_orders.py --orders 500000 --out data/synthetic \
        --catalog data/catalog.json

The data is generated, not real, but it is not uniform noise. It has the
structure the batch job is meant to recover:

  * customers favour a few cuisines and a home city      -> collaborative filtering
  * dishes have companions that are often ordered along  -> association rules
  * a long tail of light users and a few heavy ones      -> customer segments
  * delivery time depends on distance, basket size, rush -> ETA regression
  * lunch and dinner peaks, busier weekends              -> demand forecast

Standard library only, deterministic for a given --seed.
"""

import argparse
import bisect
import itertools
import json
import math
import os
import random
import time
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))

CITIES = [
    ("Bengaluru", 12.9716, 77.5946),
    ("Mumbai", 19.0760, 72.8777),
    ("Delhi", 28.6139, 77.2090),
    ("Hyderabad", 17.3850, 78.4867),
    ("Chennai", 13.0827, 80.2707),
    ("Pune", 18.5204, 73.8567),
    ("Kolkata", 22.5726, 88.3639),
    ("Ahmedabad", 23.0225, 72.5714),
]

# cuisine -> [(dish, price, companion dish or None)]
MENUS = {
    "North Indian": [
        ("Butter Chicken", 299, "Butter Naan"),
        ("Paneer Tikka Masala", 259, "Garlic Naan"),
        ("Dal Makhani", 199, "Jeera Rice"),
        ("Butter Naan", 45, None),
        ("Garlic Naan", 55, None),
        ("Jeera Rice", 129, None),
        ("Chole Bhature", 169, "Sweet Lassi"),
        ("Sweet Lassi", 79, None),
        ("Tandoori Chicken", 329, "Mint Raita"),
        ("Mint Raita", 59, None),
        ("Gulab Jamun", 89, None),
        ("Veg Biryani", 219, "Mint Raita"),
    ],
    "South Indian": [
        ("Masala Dosa", 129, "Filter Coffee"),
        ("Idli Sambar", 89, "Medu Vada"),
        ("Medu Vada", 79, None),
        ("Filter Coffee", 49, None),
        ("Rava Uttapam", 139, "Coconut Chutney"),
        ("Coconut Chutney", 29, None),
        ("Hyderabadi Chicken Biryani", 289, "Mirchi Ka Salan"),
        ("Mirchi Ka Salan", 69, None),
        ("Curd Rice", 109, None),
        ("Ghee Podi Idli", 119, "Filter Coffee"),
        ("Mysore Pak", 99, None),
        ("Pongal", 119, "Medu Vada"),
    ],
    "Chinese": [
        ("Veg Hakka Noodles", 179, "Veg Manchurian"),
        ("Veg Manchurian", 189, None),
        ("Chicken Fried Rice", 209, "Chilli Chicken"),
        ("Chilli Chicken", 239, None),
        ("Spring Rolls", 149, "Sweet Chilli Dip"),
        ("Sweet Chilli Dip", 25, None),
        ("Hot and Sour Soup", 119, "Spring Rolls"),
        ("Schezwan Fried Rice", 199, "Veg Manchurian"),
        ("Honey Chilli Potato", 169, None),
        ("Chicken Momos", 159, "Schezwan Dip"),
        ("Schezwan Dip", 25, None),
        ("Kung Pao Chicken", 259, "Chicken Fried Rice"),
    ],
    "Italian": [
        ("Margherita Pizza", 249, "Garlic Bread"),
        ("Garlic Bread", 119, None),
        ("Pasta Alfredo", 269, "Garlic Bread"),
        ("Pasta Arrabbiata", 249, "Iced Tea"),
        ("Iced Tea", 89, None),
        ("Pepperoni Pizza", 349, "Cola"),
        ("Cola", 59, None),
        ("Tiramisu", 179, None),
        ("Bruschetta", 149, None),
        ("Lasagna", 319, "Garlic Bread"),
        ("Farmhouse Pizza", 329, "Cola"),
        ("Minestrone Soup", 139, "Bruschetta"),
    ],
    "Burgers": [
        ("Classic Chicken Burger", 189, "French Fries"),
        ("French Fries", 99, None),
        ("Veg Cheese Burger", 159, "French Fries"),
        ("Peri Peri Fries", 119, None),
        ("Chocolate Shake", 149, None),
        ("Crispy Chicken Wings", 229, "Peri Peri Fries"),
        ("Double Patty Burger", 259, "Chocolate Shake"),
        ("Onion Rings", 109, None),
        ("Chicken Nuggets", 169, "Onion Rings"),
        ("Cold Coffee", 129, None),
        ("Paneer Wrap", 169, "Cold Coffee"),
        ("Loaded Nachos", 189, None),
    ],
    "Desserts": [
        ("Chocolate Brownie", 129, "Vanilla Ice Cream"),
        ("Vanilla Ice Cream", 89, None),
        ("Red Velvet Pastry", 139, None),
        ("Cheesecake Slice", 189, "Cappuccino"),
        ("Cappuccino", 119, None),
        ("Belgian Waffle", 169, "Hot Chocolate"),
        ("Hot Chocolate", 139, None),
        ("Rasmalai", 109, None),
        ("Mango Kulfi", 79, None),
        ("Choco Lava Cake", 119, "Vanilla Ice Cream"),
        ("Fruit Custard", 99, None),
        ("Donut Box", 199, "Cappuccino"),
    ],
}

NAME_PREFIXES = [
    "Royal", "Urban", "Golden", "Spice", "Green", "Blue", "Little", "Grand", "Saffron", "Coastal",
    "Tandoor", "Wok", "Olive", "Smoky", "Crispy", "Sugar", "Midnight", "Sunrise", "Twin", "Old Town",
]
NAME_SUFFIXES = [
    "Kitchen", "House", "Bowl", "Street", "Junction", "Corner", "Bistro", "Express", "Garden", "Table",
    "Canteen", "Darbar", "Cafe", "Factory", "Co.", "Hub", "Villa", "Point", "Story", "Diaries",
]

STATUS_WEIGHTS = [("delivered", 0.88), ("cancelled", 0.06), ("out_for_delivery", 0.03), ("preparing", 0.03)]

# Share of a day's orders placed in each local hour: lunch and dinner peaks.
HOUR_WEIGHTS = [1, 0.5, 0.3, 0.2, 0.2, 0.4, 1, 2, 4, 5, 5, 7, 13, 15, 10, 6, 5, 6, 9, 14, 17, 15, 9, 4]
# Monday..Sunday: weekends are busier.
WEEKDAY_WEIGHTS = [0.9, 0.9, 0.95, 1.0, 1.2, 1.45, 1.35]
RUSH_HOURS = {12, 13, 19, 20, 21}

TAX_RATE = 0.05
DELIVERY_FEE = 40


def object_id(rng):
    """24 hex characters, the same shape as a MongoDB ObjectId."""
    return f"{rng.getrandbits(96):024x}"


class WeightedPicker:
    """random.choices with the cumulative weights computed once."""

    def __init__(self, items, weights):
        self.items = list(items)
        self.cumulative = list(itertools.accumulate(weights))
        self.total = self.cumulative[-1]

    def pick(self, rng):
        return self.items[bisect.bisect_left(self.cumulative, rng.random() * self.total)]


def guess_cuisine(menu_names):
    """Match a real restaurant's menu to the closest cuisine vocabulary."""
    best, best_overlap = None, 0
    for cuisine, dishes in MENUS.items():
        overlap = len({dish for dish, _, _ in dishes} & set(menu_names))
        if overlap > best_overlap:
            best, best_overlap = cuisine, overlap
    return best


def load_catalog(path):
    if not path:
        return {"restaurants": [], "userIds": []}
    with open(path, encoding="utf-8") as handle:
        catalog = json.load(handle)
    return {
        "restaurants": [r for r in catalog.get("restaurants", []) if r.get("menu")],
        "userIds": list(catalog.get("userIds", [])),
    }


def build_restaurants(rng, catalog, synthetic_count):
    """Real restaurants from the catalogue plus generated ones."""
    restaurants = []
    cities = {name: (lat, lng) for name, lat, lng in CITIES}

    for real in catalog["restaurants"]:
        city = real.get("city") if real.get("city") in cities else CITIES[0][0]
        menu = [(item["id"], item["name"], float(item["price"]), None) for item in real["menu"]]
        restaurants.append(
            {
                "id": real["id"],
                "name": real["name"],
                "city": city,
                "cuisine": guess_cuisine([item["name"] for item in real["menu"]]) or "North Indian",
                "menu": menu,
                # Real restaurants are made popular so they show up in the results.
                "popularity": 6.0,
                "prep_minutes": rng.uniform(9, 16),
            }
        )

    cuisines = list(MENUS)
    used_names = {restaurant["name"] for restaurant in restaurants}
    for index in range(synthetic_count):
        # Walk every (cuisine, city) pair so each city offers each cuisine.
        cuisine = cuisines[index % len(cuisines)]
        city = CITIES[(index // len(cuisines)) % len(CITIES)][0]
        name = f"{rng.choice(NAME_PREFIXES)} {rng.choice(NAME_SUFFIXES)}"
        while name in used_names:
            name = f"{rng.choice(NAME_PREFIXES)} {rng.choice(NAME_SUFFIXES)} {rng.randint(2, 99)}"
        used_names.add(name)

        price_factor = rng.uniform(0.85, 1.3)
        menu = [
            (object_id(rng), dish, round(price * price_factor), companion)
            for dish, price, companion in MENUS[cuisine]
        ]
        restaurants.append(
            {
                "id": object_id(rng),
                "name": name,
                "city": city,
                "cuisine": cuisine,
                "menu": menu,
                # Pareto: a few very popular restaurants and a long tail.
                "popularity": min(8.0, rng.paretovariate(1.6)),
                "prep_minutes": rng.uniform(9, 20),
            }
        )

    if not restaurants:
        raise ValueError("No restaurants to generate orders for: pass --catalog or --synthetic-restaurants > 0")
    return restaurants


def build_users(rng, catalog, user_count, restaurants):
    cuisines = sorted({restaurant["cuisine"] for restaurant in restaurants})
    cities = sorted({restaurant["city"] for restaurant in restaurants})
    real_city = restaurants[0]["city"] if catalog["restaurants"] else None

    users = []
    ids = list(catalog["userIds"]) + [object_id(rng) for _ in range(max(0, user_count - len(catalog["userIds"])))]
    for index, user_id in enumerate(ids):
        is_real = index < len(catalog["userIds"])
        users.append(
            {
                "id": user_id,
                # Real accounts live where the real restaurants are.
                "city": real_city if is_real and real_city else rng.choice(cities),
                "cuisines": rng.sample(cuisines, k=min(2, len(cuisines))),
                # Heavy-tailed activity: most customers order rarely, a few order a lot.
                "activity": 4.0 if is_real else min(40.0, rng.paretovariate(1.2)),
            }
        )
    return users


def index_restaurants(restaurants):
    """(city, cuisine) and city -> weighted pickers over restaurants."""
    by_city_cuisine, by_city = {}, {}
    for restaurant in restaurants:
        by_city_cuisine.setdefault((restaurant["city"], restaurant["cuisine"]), []).append(restaurant)
        by_city.setdefault(restaurant["city"], []).append(restaurant)

    def picker(group):
        return WeightedPicker(group, [item["popularity"] for item in group])

    return (
        {key: picker(group) for key, group in by_city_cuisine.items()},
        {key: picker(group) for key, group in by_city.items()},
        picker(restaurants),
    )


def choose_restaurant(rng, user, pickers):
    by_city_cuisine, by_city, everywhere = pickers
    roll = rng.random()
    if roll < 0.72:
        favourite = by_city_cuisine.get((user["city"], rng.choice(user["cuisines"])))
        if favourite:
            return favourite.pick(rng)
    if roll < 0.96 and user["city"] in by_city:
        return by_city[user["city"]].pick(rng)
    return everywhere.pick(rng)


def choose_items(rng, restaurant):
    menu = restaurant["menu"]
    by_name = {name: (item_id, name, price) for item_id, name, price, _ in menu}
    lines = {}

    def add(item_id, name, price):
        line = lines.setdefault(item_id, {"menu_item_id": item_id, "name": name, "quantity": 0, "price": price})
        line["quantity"] += 1

    for _ in range(rng.choices([1, 2, 3, 4], weights=[38, 34, 19, 9])[0]):
        item_id, name, price, companion = rng.choice(menu)
        add(item_id, name, price)
        if companion and companion in by_name and rng.random() < 0.55:
            add(*by_name[companion])

    return list(lines.values())


def delivery_minutes(rng, restaurant, distance_km, item_count, hour):
    rush = 6.0 if hour in RUSH_HOURS else 0.0
    minutes = restaurant["prep_minutes"] + 3.2 * distance_km + 1.1 * item_count + rush + rng.gauss(0, 4)
    return round(max(8.0, minutes), 1)


def order_timestamp(rng, end_date, day_picker, hour_picker):
    day = day_picker.pick(rng)
    hour = hour_picker.pick(rng)
    local = datetime(end_date.year, end_date.month, end_date.day, hour, rng.randrange(60), rng.randrange(60), tzinfo=IST)
    local -= timedelta(days=day)
    return local, hour


def generate_orders(order_count, users, restaurants, days, seed, end_date=None):
    """Yields order dicts. Deterministic for a given seed and end_date."""
    rng = random.Random(seed)
    end_date = end_date or datetime.now(IST).date()

    pickers = index_restaurants(restaurants)
    user_picker = WeightedPicker(users, [user["activity"] for user in users])
    status_picker = WeightedPicker([s for s, _ in STATUS_WEIGHTS], [w for _, w in STATUS_WEIGHTS])
    hour_picker = WeightedPicker(range(24), HOUR_WEIGHTS)

    # Days ago -> weight: weekly seasonality plus mild growth towards today.
    day_weights = []
    for days_ago in range(days):
        weekday = (end_date - timedelta(days=days_ago)).weekday()
        day_weights.append(WEEKDAY_WEIGHTS[weekday] * (1.0 + 0.6 * (days - days_ago) / days))
    day_picker = WeightedPicker(range(days), day_weights)

    for _ in range(order_count):
        user = user_picker.pick(rng)
        restaurant = choose_restaurant(rng, user, pickers)
        items = choose_items(rng, restaurant)
        local_time, hour = order_timestamp(rng, end_date, day_picker, hour_picker)

        item_count = sum(line["quantity"] for line in items)
        subtotal = sum(line["price"] * line["quantity"] for line in items)
        total = round(subtotal * (1 + TAX_RATE) + DELIVERY_FEE, 2)
        distance_km = round(min(18.0, max(0.4, rng.lognormvariate(1.1, 0.55))), 2)
        status = status_picker.pick(rng)

        yield {
            "order_id": object_id(rng),
            "user_id": user["id"],
            "restaurant_id": restaurant["id"],
            "restaurant_name": restaurant["name"],
            "city": restaurant["city"],
            "created_at": local_time.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "status": status,
            "payment_status": "refunded" if status == "cancelled" else "paid",
            "total_amount": total,
            "item_count": item_count,
            "items": items,
            "distance_km": distance_km,
            "delivery_minutes": (
                delivery_minutes(rng, restaurant, distance_km, item_count, hour) if status == "delivered" else None
            ),
        }


def write_orders(orders, out_dir, part_size):
    """Writes orders as part-NNNNN.jsonl files; returns (rows, files, bytes)."""
    os.makedirs(out_dir, exist_ok=True)
    for stale in os.listdir(out_dir):
        if stale.startswith("part-") and stale.endswith(".jsonl"):
            os.remove(os.path.join(out_dir, stale))

    rows, files, size, handle = 0, 0, 0, None
    try:
        for order in orders:
            if rows % part_size == 0:
                if handle:
                    handle.close()
                handle = open(os.path.join(out_dir, f"part-{files:05d}.jsonl"), "w", encoding="utf-8", newline="\n")
                files += 1
            line = json.dumps(order, separators=(",", ":")) + "\n"
            handle.write(line)
            size += len(line)
            rows += 1
    finally:
        if handle:
            handle.close()
    return rows, files, size


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic Foodex orders for the Spark pipeline")
    parser.add_argument("--orders", type=int, default=100_000, help="Number of orders to generate")
    parser.add_argument("--users", type=int, default=0, help="Number of customers (default: orders / 20)")
    parser.add_argument("--synthetic-restaurants", type=int, default=144, help="Generated restaurants to add")
    parser.add_argument("--catalog", default="", help="catalog.json from `npm run analytics:export` (optional)")
    parser.add_argument("--days", type=int, default=180, help="Days of history to spread orders over")
    parser.add_argument("--out", required=True, help="Output directory for part-*.jsonl files")
    parser.add_argument("--part-size", type=int, default=100_000, help="Orders per output file")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    started = time.time()
    rng = random.Random(args.seed)
    catalog = load_catalog(args.catalog)
    restaurants = build_restaurants(rng, catalog, args.synthetic_restaurants)
    users = build_users(rng, catalog, args.users or max(50, math.ceil(args.orders / 20)), restaurants)

    orders = generate_orders(args.orders, users, restaurants, args.days, args.seed + 1)
    rows, files, size = write_orders(orders, args.out, args.part_size)

    elapsed = max(time.time() - started, 1e-6)
    print(
        f"Generated {rows:,} orders for {len(users):,} customers across {len(restaurants)} restaurants "
        f"({len(catalog['restaurants'])} from the live catalogue)"
    )
    print(f"Wrote {files} file(s), {size / 1_048_576:.1f} MB, to {args.out} in {elapsed:.1f}s ({rows / elapsed:,.0f} orders/s)")


if __name__ == "__main__":
    main()
