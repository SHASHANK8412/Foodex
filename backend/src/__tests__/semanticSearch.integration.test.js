// Semantic dish search on an in-memory MongoDB. A small deterministic embedder
// stands in for all-MiniLM-L6-v2 so the tests need neither the model download
// nor the network; it maps words to a few "concept" dimensions, which is enough
// to check that ranking follows meaning rather than shared words.

const harness = require("./helpers/testServer");
const request = require("supertest");

const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const embeddingService = require("../services/embeddingService");
const aiService = require("../services/aiService");

jest.setTimeout(60000);

const CONCEPTS = {
  sweet: ["sweet", "dessert", "brownie", "cake", "jamun", "sugar", "chocolate"],
  spicy: ["spicy", "chilli", "fiery", "hot", "schezwan"],
  healthy: ["healthy", "salad", "light", "greens", "quinoa"],
};

let calls = 0;
const conceptEmbedder = async (text) => {
  calls += 1;
  const words = String(text).toLowerCase();
  const vector = Object.values(CONCEPTS).map((terms) => terms.filter((term) => words.includes(term)).length);
  vector.push(0.05); // never all-zero
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return vector.map((value) => value / norm);
};

let app;
let fixture;

beforeAll(async () => {
  app = await harness.start();
});

afterAll(async () => {
  embeddingService.setEmbedderForTests(null);
  await harness.stop();
});

beforeEach(async () => {
  await harness.clearDatabase();
  embeddingService.setEmbedderForTests(conceptEmbedder);
  calls = 0;

  const admin = await User.create({ name: "Admin", email: "a@test.dev", password: "secret123", role: "admin" });
  const address = { line1: "1 Road", city: "Bengaluru", state: "Karnataka", postalCode: "560001" };
  const [open, closed] = await Restaurant.create([
    { name: "Open Kitchen", address, createdBy: admin._id, isOpen: true },
    { name: "Closed Kitchen", address, createdBy: admin._id, isOpen: false },
  ]);
  const items = await MenuItem.create([
    { restaurant: open._id, name: "Chocolate Brownie", description: "Warm fudgy dessert", category: "Desserts", price: 129 },
    { restaurant: open._id, name: "Gulab Jamun", description: "Milk dumplings in sugar syrup", category: "Desserts", price: 99 },
    { restaurant: open._id, name: "Schezwan Noodles", description: "Fiery chilli noodles", category: "Noodles", price: 199 },
    { restaurant: open._id, name: "Greek Salad", description: "Light greens with feta", category: "Salads", price: 239 },
    { restaurant: closed._id, name: "Red Velvet Cake", description: "Sweet sponge with frosting", category: "Desserts", price: 149 },
  ]);
  fixture = { open, closed, items };
});

describe("semantic dish search", () => {
  test("ranks by meaning: 'something to finish dinner, I have a sweet tooth' finds desserts", async () => {
    const results = await aiService.semanticSearchMenuItems({ query: "something to finish dinner, I have a sweet tooth", withScores: true });
    const names = results.map((entry) => entry.item.name);

    expect(names.slice(0, 2).sort()).toEqual(["Chocolate Brownie", "Gulab Jamun"]);
    expect(results[0].matchedBy).toBe("semantic");
  });

  test("leaves out dishes from closed restaurants and weak matches", async () => {
    const names = (await aiService.semanticSearchMenuItems({ query: "sweet dessert" })).map((item) => item.name);

    expect(names).not.toContain("Red Velvet Cake"); // closed
    expect(names).not.toContain("Schezwan Noodles"); // unrelated
  });

  test("a clear best match is not padded with distant ones", async () => {
    // Mostly a dessert, a little bit "salad": similarity to "salad" is about 0.3,
    // above the floor but far below the Greek Salad.
    await MenuItem.create({ restaurant: fixture.open._id, name: "Fruit Bowl", description: "Sweet fruit salad with sugar", category: "Desserts", price: 149 });

    const names = (await aiService.semanticSearchMenuItems({ query: "salad" })).map((item) => item.name);

    expect(names).toEqual(["Greek Salad"]);
  });

  test("stores each vector with the model that made it and only re-embeds what changed", async () => {
    await aiService.semanticSearchMenuItems({ query: "spicy" });
    const stored = await MenuItem.findOne({ name: "Greek Salad" });
    expect(stored.embeddingModel).toBe("test-embedder");
    expect(stored.embedding).toHaveLength(4);

    calls = 0;
    await aiService.semanticSearchMenuItems({ query: "spicy" });
    expect(calls).toBe(1); // only the query; the menu is already embedded

    await MenuItem.updateOne({ name: "Greek Salad" }, { description: "Spicy chilli salad" });
    calls = 0;
    const results = await aiService.semanticSearchMenuItems({ query: "spicy", withScores: true });
    expect(calls).toBe(2); // the edited dish and the query
    expect(results.map((entry) => entry.item.name)).toContain("Greek Salad");
  });

  test("vectors from another model are replaced, never compared", async () => {
    await MenuItem.updateMany({}, { embedding: [1, 0, 0, 0], embeddingModel: "openai:text-embedding-ada-002" });

    await aiService.semanticSearchMenuItems({ query: "healthy" });

    // Every searchable dish was re-embedded (the closed restaurant's dish is never searched).
    const models = await MenuItem.distinct("embeddingModel", { restaurant: fixture.open._id });
    expect(models).toEqual(["test-embedder"]);
  });

  test("falls back to keyword search when the model can't be loaded", async () => {
    embeddingService.setEmbedderForTests(async () => {
      throw new Error("model download failed");
    });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const results = await aiService.semanticSearchMenuItems({ query: "noodles", withScores: true });

    expect(results.map((entry) => entry.item.name)).toEqual(["Schezwan Noodles"]);
    expect(results[0].matchedBy).toBe("keyword");
    warn.mockRestore();
  });

  test("warm-up embeds the whole menu", async () => {
    const result = await aiService.warmMenuEmbeddings();

    expect(result).toEqual({ embedded: 5, model: "test-embedder" });
    expect(await MenuItem.countDocuments({ embeddingModel: "test-embedder" })).toBe(5);
  });

  test("the API returns scores but not the vectors", async () => {
    const response = await request(app).post("/api/ai/semantic-search").send({ query: "light healthy lunch", limit: 3 });

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toEqual(expect.objectContaining({ name: "Greek Salad", matchedBy: "semantic", score: expect.any(Number) }));
    expect(response.body.data[0].embedding).toBeUndefined();
    expect(response.body.data[0].semanticText).toBeUndefined();
  });
});

describe("embedding service", () => {
  test("cosine similarity", () => {
    expect(embeddingService.cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(embeddingService.cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(embeddingService.cosineSimilarity([1, 0], [1, 0, 0])).toBe(0); // different models' vectors
  });

  test("uses the local MiniLM model by default", () => {
    const saved = process.env.EMBEDDINGS_PROVIDER; // the harness turns embeddings off
    delete process.env.EMBEDDINGS_PROVIDER;
    embeddingService.setEmbedderForTests(null);
    expect(embeddingService.modelId()).toBe("local:Xenova/all-MiniLM-L6-v2");

    process.env.EMBEDDINGS_PROVIDER = "off";
    expect(embeddingService.isEnabled()).toBe(false);

    process.env.EMBEDDINGS_PROVIDER = saved;
    embeddingService.setEmbedderForTests(conceptEmbedder);
  });
});
