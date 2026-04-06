# Spark Analytics Pipeline

This module builds ML-oriented features for the Foodex MERN application using Apache Spark.

## Features Generated

- Recommendation candidates per user (`recommendations`)
- Hourly demand forecast per restaurant (`demand_forecast`)
- Delivery ETA regression coefficients (`delivery_eta_model`)

## Prerequisites

- Python 3.10+
- Java 8/11+
- Spark runtime (`pyspark`)

## Install

```bash
pip install -r analytics/requirements.txt
```

## Run

```bash
spark-submit analytics/spark_foodex_features.py \
  --input analytics/sample/orders.json \
  --output analytics/output \
  --format json
```

After execution, copy/export generated records to the backend output files consumed by APIs:

- `analytics/output/recommendations/recommendations.json`
- `analytics/output/demand_forecast/demand_forecast.json`
- `analytics/output/delivery_eta_model/delivery_eta_model.json`

You can also push these to data lake/object storage and sync them into your API layer.
