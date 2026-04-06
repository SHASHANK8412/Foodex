from pyspark.sql import SparkSession
from pyspark.sql.functions import col, count, avg, hour, row_number, lit
from pyspark.sql.window import Window
from pyspark.ml.feature import VectorAssembler
from pyspark.ml.regression import LinearRegression
import argparse


def build_recommendations(orders_df):
    user_restaurant = (
        orders_df.groupBy("user", "restaurant")
        .agg(count("_id").alias("interaction_count"))
    )

    rank_window = Window.partitionBy("user").orderBy(col("interaction_count").desc())
    recommendations = (
        user_restaurant.withColumn("rank", row_number().over(rank_window))
        .where(col("rank") <= 5)
        .select(
            col("user").alias("userId"),
            col("restaurant").alias("restaurantId"),
            col("interaction_count").alias("score"),
            col("rank")
        )
    )

    return recommendations


def build_demand_forecast(orders_df):
    with_hour = orders_df.withColumn("hour_of_day", hour(col("createdAt")))
    demand = (
        with_hour.groupBy("restaurant", "hour_of_day")
        .agg(count("_id").alias("expected_orders"))
        .select(
            col("restaurant").alias("restaurantId"),
            col("hour_of_day"),
            col("expected_orders")
        )
    )

    return demand


def build_delivery_eta_model(orders_df):
    enriched = orders_df

    if "distance_km" not in enriched.columns:
        enriched = enriched.withColumn("distance_km", lit(4.0))

    if "item_count" not in enriched.columns:
        enriched = enriched.withColumn("item_count", lit(2.0))

    if "actual_delivery_minutes" not in enriched.columns:
        enriched = enriched.withColumn("actual_delivery_minutes", lit(35.0))

    if "hour_of_day" not in enriched.columns:
        enriched = enriched.withColumn("hour_of_day", hour(col("createdAt")))

    features = ["distance_km", "item_count", "hour_of_day"]
    assembler = VectorAssembler(inputCols=features, outputCol="features")
    dataset = assembler.transform(enriched).select("features", col("actual_delivery_minutes").alias("label"))

    model = LinearRegression(maxIter=20, regParam=0.1, elasticNetParam=0.1).fit(dataset)

    coefficients = model.coefficients.toArray().tolist()

    rows = [
        {
            "model": "linear_regression",
            "intercept": float(model.intercept),
            "distanceKmCoeff": float(coefficients[0]),
            "itemCountCoeff": float(coefficients[1]),
            "hourCoeff": float(coefficients[2]),
            "rmse": float(model.summary.rootMeanSquaredError),
        }
    ]

    return rows


def main():
    parser = argparse.ArgumentParser(description="Build Spark features for Foodex analytics")
    parser.add_argument("--input", required=True, help="Input path (json/parquet) for order-level dataset")
    parser.add_argument("--output", required=True, help="Output directory for generated feature files")
    parser.add_argument("--format", default="json", choices=["json", "parquet"], help="Input dataset format")
    args = parser.parse_args()

    spark = SparkSession.builder.appName("foodex-spark-analytics").getOrCreate()

    if args.format == "parquet":
        orders_df = spark.read.parquet(args.input)
    else:
        orders_df = spark.read.option("multiline", "true").json(args.input)

    recommendations = build_recommendations(orders_df)
    demand = build_demand_forecast(orders_df)
    eta_rows = build_delivery_eta_model(orders_df)

    recommendations.coalesce(1).write.mode("overwrite").json(f"{args.output}/recommendations")
    demand.coalesce(1).write.mode("overwrite").json(f"{args.output}/demand_forecast")

    eta_df = spark.createDataFrame(eta_rows)
    eta_df.coalesce(1).write.mode("overwrite").json(f"{args.output}/delivery_eta_model")

    spark.stop()


if __name__ == "__main__":
    main()
