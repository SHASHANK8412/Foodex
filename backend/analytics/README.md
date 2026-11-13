# Foodex analytics pipeline (Spark)

PySpark jobs for the Foodex platform. See the [root README](../../README.md) for
how they fit with Kafka and the web application.

| File | What it is |
|---|---|
| `streaming_pipeline.py` | Spark Structured Streaming: Kafka -> windowed metrics -> Kafka, and Kafka -> bronze Parquet |
| `batch_features.py` | Spark batch + MLlib: orders -> silver table -> gold datasets served by the API |
| `generate_orders.py` | Synthetic order generator (standard library only) |
| `foodex_schemas.py` | Schemas for orders and Kafka events, shared by both jobs |
| `tests/` | pytest suite: generator (pure Python), batch and streaming transformations (need Spark) |
| `Dockerfile` | Spark 3.5.4 image with NumPy, used by `docker-compose.yml` at the repo root |

## Data layout

```
analytics/
  data/                 inputs (git-ignored)
    catalog.json          restaurants, menus, customer ids   <- npm run analytics:export
    orders/orders.jsonl   real orders from MongoDB           <- npm run analytics:export
    synthetic/part-*.jsonl generated orders                  <- generate_orders.py
  lake/                 data lake (git-ignored)
    bronze/events/        raw Kafka events, Parquet, partitioned by topic and date  <- streaming job
    silver/orders/        valid, de-duplicated orders, Parquet, partitioned by date <- batch job
  output/               gold datasets the API serves (git-ignored)  <- batch job
    <dataset>/part-*.json
    _manifest.json        when the job ran, on what data, model metrics
```

## Streaming job

Reads `foodex.order.created`, `foodex.order.paid`, `foodex.order.status`,
`foodex.delivery.assigned` and `foodex.clickstream`, and runs four queries:

| Query | Output | Sink |
|---|---|---|
| `order_windows` | orders and order value per restaurant per 1-minute window | Kafka `foodex.analytics.realtime` |
| `trending_items` | units ordered per dish per 1-minute window | Kafka `foodex.analytics.realtime` |
| `funnel` | events per funnel stage per 1-minute window | Kafka `foodex.analytics.realtime` |
| `bronze_events` | every raw event with topic, partition, offset | Parquet, `lake/bronze/events` |

Windows use event time (`occurredAt`, set by the producer) with a 2-minute
watermark and `update` output mode. Each query has its own checkpoint, so it
resumes from its last committed Kafka offsets after a restart.

Started by `docker compose up -d --build`. To run it by hand:

```bash
spark-submit \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.4 \
  streaming_pipeline.py --brokers localhost:9092 --lake lake --checkpoints checkpoints
```

## Batch job

```bash
python batch_features.py \
  --input data/orders data/synthetic \
  --output output --lake lake --dataset-label synthetic
```

| Dataset | Method | Served by |
|---|---|---|
| `recommendations` | ALS, implicit feedback (order counts as confidence); per-customer popularity when there is too little data | `GET /api/analytics/recommendations`, home page |
| `customer_segments`, `user_segments` | K-Means on log-scaled, standardised recency / frequency / spend; silhouette score in the manifest | admin pipeline page |
| `basket_rules` | FP-Growth association rules with confidence and lift | admin pipeline page |
| `delivery_eta_model` | Linear regression on distance, item count, hour; evaluated on a held-out 20% (RMSE, MAE, R²); exported as coefficients | `GET /api/analytics/delivery-estimate`, checkout |
| `demand_forecast` | average orders per restaurant per hour of day over active days | `GET /api/analytics/demand/:restaurantId` |
| `restaurant_kpis`, `top_items`, `hourly_heatmap` | Spark SQL aggregations | admin pipeline page |

Options: `--include-lake-events` also rebuilds orders from the Kafka events in
`lake/bronze` (the streaming job's output); `--timezone` sets the zone for
hour-of-day features (default `Asia/Kolkata`); `--top-k`, `--segments`,
`--min-support` tune the models.

The job only uses DataFrame and MLlib APIs, so no Python runs on the executors.

## Synthetic data

A demo database has a few dozen orders, which is not enough to train or to show
Spark doing anything. `generate_orders.py` produces as many orders as you ask
for, in the same schema, with structure for the models to find: cuisine and
city preferences, companion dishes, heavy-tailed customer activity, lunch and
dinner peaks, and delivery times that depend on distance and basket size.

```bash
python generate_orders.py --orders 1000000 --catalog data/catalog.json --out data/synthetic
```

With `--catalog` the generated orders include the real restaurants and customer
accounts, so recommendations resolve to restaurants that exist in the app. It is
generated data: label runs that use it (`--dataset-label synthetic`), which the
UI then displays.

## Running locally without Docker

Needs Python 3.10+, Java 17, and on Windows a Hadoop `winutils` setup for Spark
to write files (using Docker avoids that).

```bash
pip install -r requirements.txt
python -m pytest tests
```
