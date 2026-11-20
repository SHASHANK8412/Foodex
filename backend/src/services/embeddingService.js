const path = require("path");
const env = require("../config/env");

// Text embeddings for semantic search.
//
// Default: all-MiniLM-L6-v2 (sentence-transformers, Apache-2.0) running inside
// this process through Transformers.js, using its ONNX build
// (Xenova/all-MiniLM-L6-v2). 384-dimensional, normalized vectors. No API key;
// the model (about 23 MB quantized) is downloaded once on first use and cached.
//
// With OPENAI_API_KEY set and EMBEDDINGS_PROVIDER=openai, OpenAI embeddings are
// used instead. EMBEDDINGS_PROVIDER=off disables embeddings (keyword search only).

const LOCAL_MODEL = process.env.LOCAL_EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2";
const CACHE_DIR = process.env.EMBEDDING_CACHE_DIR || path.join(__dirname, "..", "..", ".cache", "models");

let extractorPromise = null;
let testEmbedder = null;

const providerName = () => {
  if (testEmbedder) return "test";
  const choice = (process.env.EMBEDDINGS_PROVIDER || "local").toLowerCase();
  if (choice === "off") return "off";
  if (choice === "openai" && env.openaiApiKey) return "openai";
  return "local";
};

const loadLocalExtractor = () => {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      // Transformers.js is an ES module.
      const transformers = await import("@huggingface/transformers");
      transformers.env.cacheDir = CACHE_DIR;
      transformers.env.allowLocalModels = false;
      return transformers.pipeline("feature-extraction", LOCAL_MODEL, { dtype: "q8" });
    })().catch((error) => {
      // Let a later call retry (for example after a network blip during download).
      extractorPromise = null;
      throw error;
    });
  }
  return extractorPromise;
};

let openAiClient = null;
const getOpenAiClient = () => {
  if (!openAiClient) {
    const { OpenAIEmbeddings } = require("@langchain/openai");
    openAiClient = new OpenAIEmbeddings({ apiKey: env.openaiApiKey, model: env.embeddingModel });
  }
  return openAiClient;
};

/** The id stored with each vector, so vectors from a different model are never compared. */
const modelId = () => {
  const name = providerName();
  if (name === "test") return "test-embedder";
  if (name === "openai") return `openai:${env.embeddingModel}`;
  if (name === "local") return `local:${LOCAL_MODEL}`;
  return null;
};

const isEnabled = () => providerName() !== "off";

/**
 * Embeds texts. Returns one array of numbers per text, normalized to unit length
 * (so cosine similarity is a dot product).
 */
const embed = async (texts) => {
  const inputs = (Array.isArray(texts) ? texts : [texts]).map((text) => String(text || "").slice(0, 2000));
  if (!inputs.length) return [];

  const name = providerName();
  if (name === "test") return Promise.all(inputs.map((text) => testEmbedder(text)));
  if (name === "openai") return getOpenAiClient().embedDocuments(inputs);
  if (name === "off") throw new Error("Embeddings are disabled (EMBEDDINGS_PROVIDER=off)");

  const extractor = await loadLocalExtractor();
  const output = await extractor(inputs, { pooling: "mean", normalize: true });
  return output.tolist();
};

const embedOne = async (text) => (await embed([text]))[0];

const cosineSimilarity = (a = [], b = []) => {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom ? dot / denom : 0;
};

// Tests swap in a deterministic embedder so they need neither the model nor the network.
const setEmbedderForTests = (fn) => {
  testEmbedder = fn;
};

module.exports = {
  LOCAL_MODEL,
  embed,
  embedOne,
  modelId,
  isEnabled,
  providerName,
  cosineSimilarity,
  setEmbedderForTests,
};
