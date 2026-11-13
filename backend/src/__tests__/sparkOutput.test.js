process.env.NODE_ENV = "test";

const fs = require("fs");
const os = require("os");
const path = require("path");

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "foodex-spark-output-"));
process.env.ANALYTICS_OUTPUT_DIR = outputDir;

const store = require("../services/sparkOutputStore");
const analyticsService = require("../services/analyticsService");
const pipelineService = require("../services/pipelineService");

// Writes a dataset the way Spark does: a directory of JSON-lines part files
// next to _SUCCESS and checksum files.
const writeSparkDataset = (name, rows) => {
  const directory = path.join(outputDir, name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "_SUCCESS"), "");
  fs.writeFileSync(path.join(directory, ".part-00000-abc.json.crc"), "crc");
  fs.writeFileSync(
    path.join(directory, "part-00000-abc.json"),
    rows.map((row) => JSON.stringify(row)).join("\n") + "\n"
  );
};

afterAll(() => {
  fs.rmSync(outputDir, { recursive: true, force: true });
});

describe("Spark output store", () => {
  test("returns an empty dataset when the batch job has not run", () => {
    expect(store.readDataset("recommendations")).toEqual([]);
    expect(store.readManifest()).toBeNull();
    expect(pipelineService.getBatchInsights().available).toBe(false);
  });

  test("reads Spark part files and ignores _SUCCESS and checksum files", () => {
    writeSparkDataset("top_items", [
      { itemName: "Paneer Tikka", quantity: 40, revenue: 9000 },
      { itemName: "Hakka Noodles", quantity: 75, revenue: 12000 },
    ]);

    expect(store.readDataset("top_items")).toHaveLength(2);
    expect(store.hasDataset("top_items")).toBe(true);
  });

  test("accepts a single JSON array file as well", () => {
    fs.writeFileSync(
      path.join(outputDir, "hourly_heatmap.json"),
      JSON.stringify([{ dayOfWeek: 1, hour: 20, orders: 12 }])
    );

    expect(store.readDataset("hourly_heatmap")).toEqual([{ dayOfWeek: 1, hour: 20, orders: 12 }]);
  });

  test("skips malformed lines instead of discarding the dataset", () => {
    const directory = path.join(outputDir, "restaurant_kpis");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, "part-00000.json"),
      '{"restaurantId":"r1","revenue":10}\n{broken\n{"restaurantId":"r2","revenue":30}\n'
    );

    expect(store.readDataset("restaurant_kpis").map((row) => row.restaurantId)).toEqual(["r1", "r2"]);
  });

  test("picks up a re-run of the job without restarting the API", () => {
    writeSparkDataset("customer_segments", [{ segment: "Champions", customers: 10 }]);
    expect(store.readDataset("customer_segments")).toHaveLength(1);

    writeSparkDataset("customer_segments", [
      { segment: "Champions", customers: 12 },
      { segment: "Occasional", customers: 30 },
    ]);
    expect(store.readDataset("customer_segments")).toHaveLength(2);
  });
});

describe("serving Spark features", () => {
  test("scores delivery ETA with the exported regression coefficients", () => {
    writeSparkDataset("delivery_eta_model", [
      {
        model: "linear_regression",
        intercept: 10,
        distanceKmCoeff: 5,
        itemCountCoeff: 1,
        hourCoeff: 0,
        rmse: 4.2,
        r2: 0.81,
        trainRows: 8000,
      },
    ]);

    const estimate = analyticsService.estimateDeliveryTime({ distanceKm: 4, itemCount: 3, hourOfDay: 19 });

    expect(estimate.source).toBe("spark_model");
    expect(estimate.estimatedMinutes).toBe(33);
    expect(estimate.model).toEqual({ rmse: 4.2, r2: 0.81, trainRows: 8000 });
  });

  test("builds the insights payload from gold datasets and the run manifest", () => {
    fs.writeFileSync(
      path.join(outputDir, "_manifest.json"),
      JSON.stringify({ generatedAt: "2026-11-12T10:00:00Z", datasetLabel: "synthetic", counts: { orders: 50000 } })
    );
    writeSparkDataset("basket_rules", [
      { antecedent: ["Butter Naan"], consequent: ["Dal Makhani"], confidence: 0.6, lift: 3.1, support: 0.02 },
      { antecedent: ["Fried Rice"], consequent: ["Manchurian"], confidence: 0.5, lift: 4.4, support: 0.03 },
    ]);

    const insights = pipelineService.getBatchInsights();

    expect(insights.available).toBe(true);
    expect(insights.manifest.datasetLabel).toBe("synthetic");
    expect(insights.basketRules[0].lift).toBe(4.4);
    expect(insights.topItems[0].itemName).toBe("Hakka Noodles");
    expect(insights.segments[0].segment).toBe("Occasional");
    expect(insights.etaModel.r2).toBe(0.81);
  });
});
