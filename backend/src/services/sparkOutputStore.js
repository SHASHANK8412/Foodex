const fs = require("fs");
const path = require("path");
const env = require("../config/env");

// Reads the "gold" datasets written by the Spark batch job
// (analytics/jobs/batch_features.py) so the API can serve them.
//
// Spark writes each dataset as a directory of JSON-lines part files
// (<output>/<name>/part-*.json). A single <output>/<name>.json file holding
// either a JSON array or JSON lines is accepted too.

const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MANIFEST_FILE = "_manifest.json";

const cache = new Map();

const outputDir = () => env.analyticsOutputDir;

const safeStat = (target) => {
  try {
    return fs.statSync(target);
  } catch (_error) {
    return null;
  }
};

const datasetFiles = (name) => {
  const directory = path.join(outputDir(), name);
  const directoryStat = safeStat(directory);

  if (directoryStat?.isDirectory()) {
    return fs
      .readdirSync(directory)
      .filter((file) => file.startsWith("part-") && file.endsWith(".json"))
      .sort()
      .map((file) => path.join(directory, file));
  }

  const single = path.join(outputDir(), `${name}.json`);
  return safeStat(single)?.isFile() ? [single] : [];
};

const parseRows = (raw) => {
  const text = raw.trim();
  if (!text) {
    return [];
  }

  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  const rows = [];
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    try {
      rows.push(JSON.parse(trimmed));
    } catch (_error) {
      // Skip a malformed line rather than discard the whole dataset.
    }
  });
  return rows;
};

// Returns the rows of a dataset, or [] when the Spark job has not produced it.
const readDataset = (name) => {
  const files = datasetFiles(name);
  if (!files.length) {
    cache.delete(name);
    return [];
  }

  const stats = files.map((file) => ({ file, stat: safeStat(file) })).filter((entry) => entry.stat);
  const signature = stats.map(({ file, stat }) => `${file}:${stat.mtimeMs}:${stat.size}`).join("|");

  const cached = cache.get(name);
  if (cached?.signature === signature) {
    return cached.rows;
  }

  const rows = [];
  stats.forEach(({ file, stat }) => {
    if (stat.size > MAX_FILE_BYTES) {
      console.warn(`[SPARK OUTPUT] Skipping ${file}: larger than ${MAX_FILE_BYTES} bytes`);
      return;
    }
    try {
      parseRows(fs.readFileSync(file, "utf-8")).forEach((row) => rows.push(row));
    } catch (_error) {
      // An unreadable part file is treated as missing.
    }
  });

  cache.set(name, { signature, rows });
  return rows;
};

const hasDataset = (name) => datasetFiles(name).length > 0;

// Run metadata written by the batch job: when it ran, on what data, model metrics.
const readManifest = () => {
  const file = path.join(outputDir(), MANIFEST_FILE);
  try {
    if (!fs.existsSync(file)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
};

const clearCache = () => cache.clear();

module.exports = {
  readDataset,
  hasDataset,
  readManifest,
  clearCache,
};
