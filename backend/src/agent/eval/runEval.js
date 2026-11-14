// Evaluates the ordering agent on the 50-request set.
//
//   npm run agent:eval                         # rule-based baseline
//   npm run agent:eval -- --engine gemini      # LLM agent (needs GOOGLE_GEMINI_API_KEY)
//   npm run agent:eval -- --engine groq --model llama-3.3-70b-versatile
//   npm run agent:eval -- --ids 1,8,40         # a subset
//
// Runs against a fresh in-memory MongoDB seeded with the demo catalogue, so
// results do not depend on (or change) the development database. Writes
// results/<engine>.json and results/<engine>.md next to this file.
//
// Scoring, per request, against the hand-written ground truth in requests.js:
//   feasible request   -> success if the agent proposes a cart that passes the
//                         validator under the ground-truth spec
//   infeasible request -> success if the agent declines (proposes nothing)
// An oracle searches the catalogue exhaustively to decide which requests are
// feasible, and the run reports any case where it disagrees with requests.js.

const fs = require("fs");
const os = require("os");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../../../.env"), quiet: true });
process.env.NODE_ENV = "test";
process.env.KAFKA_ENABLED = "false";
process.env.REDIS_ENABLED = "false";
process.env.RAZORPAY_KEY_ID = "";
process.env.RAZORPAY_KEY_SECRET = "";
process.env.FIREBASE_SERVICE_ACCOUNT = "";
// The heuristic ETA, not whatever Spark output happens to be on disk.
process.env.ANALYTICS_OUTPUT_DIR = path.join(os.tmpdir(), "foodex-eval-no-spark-output");

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const flag = (name, fallback = null) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : "n/a");
const quantile = (values, q) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

const main = async () => {
  const engine = flag("engine", "rules");
  const model = flag("model");
  const ids = flag("ids") ? flag("ids").split(",").map(Number) : null;
  const outDir = flag("out", path.join(__dirname, "results"));

  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "foodex-eval" });

  // Silence the app's informational logging during the run.
  const log = console.log;
  console.log = () => undefined;
  const { seedDemoData } = require("../../seeders/demoData");
  await seedDemoData({ force: true });
  console.log = log;

  const { planOrder } = require("../orderingAgent");
  const { resolveProvider } = require("../llm/providers");
  const { validateCart } = require("../validator");
  const { normalizeSpec } = require("../orderSpec");
  const { loadCatalog, cheapestCart, restaurantMatchesCuisine } = require("../catalog");
  const { estimateOrderEta } = require("../../services/analyticsService");
  const { TAX_RATE, DELIVERY_FEE } = require("../../services/pricingService");
  const cases = require("./requests").filter((entry) => !ids || ids.includes(entry.id));

  const provider = engine === "rules" ? null : resolveProvider({ provider: engine, models: model ? [model] : undefined });
  if (engine !== "rules" && !provider) {
    throw new Error(`No API key configured for ${engine}`);
  }

  // Exhaustive oracle: is there any valid cart for this spec?
  const catalog = await loadCatalog();
  const oracle = (spec, options) => {
    let best = null;
    for (const { restaurant, items } of catalog) {
      if (!restaurant.isOpen || !restaurantMatchesCuisine(restaurant, spec)) continue;
      const cart = cheapestCart(spec, items, options);
      if (!cart) continue;
      const total = round2(cart.subtotal + round2(cart.subtotal * TAX_RATE) + DELIVERY_FEE);
      const eta = estimateOrderEta({ restaurant, itemCount: cart.items.reduce((sum, line) => sum + line.quantity, 0) }).minutes;
      const fits = (!spec.budgetTotal || total <= spec.budgetTotal) && (!spec.maxDeliveryMinutes || eta <= spec.maxDeliveryMinutes);
      if (fits && (!best || total < best.total)) best = { restaurant: restaurant.name, total, eta };
    }
    return best;
  };

  const rows = [];
  for (const testCase of cases) {
    const truth = normalizeSpec(testCase.expected);
    const cheapest = oracle(truth);
    const feasible = Boolean(cheapest);
    const sensible = Boolean(oracle(truth, { preferMeals: true }));

    let result;
    let error = null;
    try {
      result = await planOrder({ text: testCase.text, provider });
    } catch (planError) {
      error = planError.message;
      result = { status: "error", proposals: 0, latencyMs: 0, usage: {}, corrections: [], models: [] };
    }

    let validUnderTruth = false;
    let truthFailures = [];
    if (result.status === "proposed") {
      const check = await validateCart({
        spec: truth,
        restaurantId: result.validation.restaurant.id,
        items: result.validation.lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
      });
      validUnderTruth = check.passed;
      truthFailures = check.checks.filter((entry) => !entry.passed).map((entry) => `${entry.label}: ${entry.detail}`);
    }

    const outcome = feasible
      ? validUnderTruth
        ? result.proposals <= 1
          ? "valid_first_try"
          : "valid_after_replan"
        : result.status === "proposed"
          ? "invalid_cart"
          : "missed"
      : result.status === "proposed"
        ? "invalid_cart"
        : "correct_decline";

    const row = {
      id: testCase.id,
      text: testCase.text,
      feasible,
      authorExpectedFeasible: testCase.feasible,
      sensibleCartExists: sensible,
      oracleCheapest: cheapest,
      outcome,
      success: ["valid_first_try", "valid_after_replan", "correct_decline"].includes(outcome),
      status: result.status,
      engine: result.engine,
      models: result.models,
      fallbackReason: result.fallbackReason || null,
      proposals: result.proposals,
      latencyMs: result.latencyMs,
      modelCalls: result.usage?.modelCalls || 0,
      inputTokens: result.usage?.inputTokens || 0,
      outputTokens: result.usage?.outputTokens || 0,
      specCorrections: (result.corrections || []).map((entry) => entry.field),
      cart: result.validation
        ? { restaurant: result.validation.restaurant.name, total: result.validation.quote.totalAmount, eta: result.validation.eta.minutes, items: result.validation.lines.map((line) => `${line.quantity}x ${line.name}`) }
        : null,
      agentSpec: result.spec,
      truthFailures,
      reason: result.reason || error || null,
    };
    rows.push(row);
    log(
      `${String(testCase.id).padStart(2)} ${row.success ? "PASS" : "FAIL"} ${outcome.padEnd(18)} ${(row.latencyMs / 1000).toFixed(1).padStart(5)}s ` +
        `${row.proposals}p ${row.modelCalls}c ${row.fallbackReason ? "[fallback] " : ""}${testCase.text}`
    );
  }

  // --merge with --ids re-runs some cases (for example ones that hit a provider
  // rate limit) and keeps the earlier results for the rest.
  if (process.argv.includes("--merge") && ids) {
    const previousFile = path.join(outDir, `${engine}.json`);
    if (fs.existsSync(previousFile)) {
      const previous = JSON.parse(fs.readFileSync(previousFile, "utf-8")).rows || [];
      rows.unshift(...previous.filter((row) => !ids.includes(row.id)));
      rows.sort((a, b) => a.id - b.id);
    }
  }

  const llmRows = rows.filter((row) => row.engine !== "rules");
  const feasibleRows = rows.filter((row) => row.feasible);
  const infeasibleRows = rows.filter((row) => !row.feasible);
  const count = (list, outcome) => list.filter((row) => row.outcome === outcome).length;
  // Latency of the LLM agent itself; fallbacks answer in milliseconds and would flatter it.
  const latencies = (engine === "rules" ? rows : llmRows).filter((row) => row.status !== "error").map((row) => row.latencyMs);

  const summary = {
    engine,
    models: [...new Set(rows.flatMap((row) => row.models || []))],
    ranAt: new Date().toISOString(),
    requests: rows.length,
    successes: rows.filter((row) => row.success).length,
    feasible: {
      total: feasibleRows.length,
      validFirstTry: count(feasibleRows, "valid_first_try"),
      validAfterReplan: count(feasibleRows, "valid_after_replan"),
      invalidCart: count(feasibleRows, "invalid_cart"),
      missed: count(feasibleRows, "missed"),
    },
    infeasible: {
      total: infeasibleRows.length,
      correctlyDeclined: count(infeasibleRows, "correct_decline"),
      invalidCart: count(infeasibleRows, "invalid_cart"),
    },
    latency: {
      meanMs: Math.round(latencies.reduce((sum, value) => sum + value, 0) / Math.max(latencies.length, 1)),
      p50Ms: quantile(latencies, 0.5),
      p95Ms: quantile(latencies, 0.95),
    },
    meanModelCalls: round2(rows.reduce((sum, row) => sum + row.modelCalls, 0) / Math.max(rows.length, 1)),
    totalTokens: rows.reduce((sum, row) => sum + row.inputTokens + row.outputTokens, 0),
    specCorrections: rows.filter((row) => row.specCorrections.length).length,
    fallbacks: rows.filter((row) => row.fallbackReason).length,
    // Requests the LLM itself answered (no fallback to the rule-based planner).
    llmOnly: {
      answered: llmRows.length,
      successes: llmRows.filter((row) => row.success).length,
    },
    errors: rows.filter((row) => row.status === "error").length,
    oracleDisagreements: rows.filter((row) => row.feasible !== row.authorExpectedFeasible).map((row) => row.id),
    ambiguousCases: rows.filter((row) => row.feasible && !row.sensibleCartExists).map((row) => row.id),
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${engine}.json`), JSON.stringify({ summary, rows }, null, 2));

  const f = summary.feasible;
  const md = [
    `# Ordering agent evaluation: ${engine}${summary.models.length ? ` (${summary.models.join(", ")})` : ""}`,
    "",
    `Run ${summary.ranAt} on ${summary.requests} requests (${f.total} that a valid cart can satisfy, ${summary.infeasible.total} that none can).`,
    "",
    "| Metric | Result |",
    "|---|---|",
    `| Overall success | **${summary.successes}/${summary.requests} (${percent(summary.successes, summary.requests)})** |`,
    `| Valid cart, feasible requests | ${f.validFirstTry + f.validAfterReplan}/${f.total} (${percent(f.validFirstTry + f.validAfterReplan, f.total)}) |`,
    `| ... on the first proposal | ${f.validFirstTry}/${f.total} (${percent(f.validFirstTry, f.total)}) |`,
    `| ... after re-planning | ${f.validAfterReplan}/${f.total} |`,
    `| Cart proposed that breaks the request | ${f.invalidCart + summary.infeasible.invalidCart} |`,
    `| Feasible request wrongly declined | ${f.missed} |`,
    `| Infeasible requests correctly declined | ${summary.infeasible.correctlyDeclined}/${summary.infeasible.total} |`,
    `| Latency mean / p50 / p95 | ${(summary.latency.meanMs / 1000).toFixed(1)}s / ${(summary.latency.p50Ms / 1000).toFixed(1)}s / ${(summary.latency.p95Ms / 1000).toFixed(1)}s |`,
    `| Model calls per request (mean) | ${summary.meanModelCalls} |`,
    `| Requests where the LLM's spec was corrected | ${summary.specCorrections} |`,
    `| Fallbacks to the rule-based planner | ${summary.fallbacks} |`,
    ...(engine === "rules"
      ? []
      : [`| Success on requests the LLM answered itself | ${summary.llmOnly.successes}/${summary.llmOnly.answered} (${percent(summary.llmOnly.successes, summary.llmOnly.answered)}) |`]),
    "",
    summary.oracleDisagreements.length ? `Oracle disagrees with the expected feasibility for cases: ${summary.oracleDisagreements.join(", ")}.` : "The oracle agrees with the expected feasibility of every case.",
    "",
    "## Failures",
    "",
    ...rows
      .filter((row) => !row.success)
      .map((row) => `- **#${row.id}** "${row.text}": ${row.outcome}${row.truthFailures.length ? ` (${row.truthFailures.join("; ")})` : ""}${row.reason ? `. Agent: ${row.reason}` : ""}`),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, `${engine}.md`), md);

  log(`\n${md}`);
  await mongoose.disconnect();
  await mongo.stop();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
