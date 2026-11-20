const pricingService = require("../services/pricingService");
const { estimateOrderEta } = require("../services/analyticsService");
const { parseRequest, reconcileSpec, CUISINES } = require("./orderSpec");
const { searchMenus, loadCatalog, cheapestCart, restaurantMatchesCuisine } = require("./catalog");
const { validateCart } = require("./validator");
const { diagnose } = require("./diagnose");
const { resolveProviders, isAuthError, markAuthFailure, isCoolingDown } = require("./llm/providers");

// The AI ordering agent.
//
//   1. understand: the LLM records a structured spec; reconcileSpec cross-checks
//      it against the request text and corrects explicit numbers and diet.
//   2. act: it calls Foodex's own services as tools (menu search, pricing).
//   3. verify: every proposed cart goes through validateCart. Failures go back
//      to the model with the reasons, and it re-plans (up to MAX_PROPOSALS).
//   4. hand over: the result is a proposal. The agent has no tool that places
//      an order or takes payment; the customer confirms, and only then is an
//      order (and a Razorpay payment order) created.

const MAX_MODEL_TURNS = 10;
const MAX_PROPOSALS = 3;

const SYSTEM_PROMPT = `You are the ordering assistant for Foodex, a food delivery app in Bengaluru.
Turn the customer's request into one cart from one restaurant that satisfies it.
You cannot place orders or take payment: you propose a cart and the customer confirms it.

Work in this order, keeping the number of turns small:
1. In your first reply, call record_order_spec and search_menus together. Record only what the customer asked for; leave a field empty when the request does not mention it.
2. Pick a restaurant and dishes from the search results and work out the total yourself (see Facts).
3. Call propose_cart. The server prices it and checks it against the spec. If a check fails you get the reasons: change the cart (cheaper dishes, fewer items, another restaurant) and propose again. quote_cart is only for when you are unsure.
4. If no cart can satisfy the request (for example nothing is fast enough, or the budget is below the cheapest possible order), call report_infeasible with the reason and the closest option.

Facts:
- The payable total is the dish subtotal plus 5% tax plus a 40 rupee delivery fee.
- Each person needs at least one dish; drinks do not count as a dish.
- Use only menuItemId and restaurantId values returned by search_menus.
- For a meal, prefer proper dishes over sides, and some variety, within the budget.`;

const SPEC_SCHEMA = {
  type: "object",
  properties: {
    diet: { type: "string", enum: ["veg", "any"], description: "veg when the customer (or anyone in the group) wants vegetarian food" },
    cuisines: {
      type: "array",
      items: { type: "string", enum: CUISINES },
      description:
        "Only when the customer names a cuisine or kind of restaurant (Chinese, Italian, South Indian, healthy). A dish such as biryani, pizza, salad or dessert is not a cuisine: put it in include. Empty if none.",
    },
    spice: { type: "string", enum: ["hot", "no_hot", "none"], description: "hot: wants something spicy. no_hot: wants nothing spicy. none: not mentioned" },
    partySize: { type: "integer", description: "Number of people to feed" },
    budgetTotal: { type: "number", description: "Maximum total in rupees including tax and delivery; 0 if not mentioned" },
    maxDeliveryMinutes: { type: "integer", description: "Latest acceptable delivery in minutes; 0 if not mentioned" },
    include: { type: "array", items: { type: "string" }, description: "Dishes the customer explicitly asked for, as short words: pizza, dosa, biryani, dessert. Empty if they did not name a dish." },
    exclude: { type: "array", items: { type: "string" }, description: "Ingredients or dishes to avoid, e.g. mushroom, paneer" },
  },
  required: ["diet", "partySize"],
};

const CART_ITEMS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { menuItemId: { type: "string" }, quantity: { type: "integer" } },
    required: ["menuItemId", "quantity"],
  },
};

const TOOLS = [
  {
    name: "record_order_spec",
    description: "Record the constraints from the customer's request. Call this first, once.",
    parameters: SPEC_SCHEMA,
  },
  {
    name: "search_menus",
    description: "Open restaurants with their delivery time in minutes and their dishes (id, name, price, isVeg, spiceLevel, category). Backed by GET /api/restaurants and /api/restaurants/:id.",
    parameters: {
      type: "object",
      properties: {
        cuisines: { type: "array", items: { type: "string", enum: CUISINES }, description: "Only restaurants with one of these cuisines" },
        vegOnly: { type: "boolean", description: "Only vegetarian dishes" },
        notSpicy: { type: "boolean", description: "Leave out hot dishes" },
        maxItemPrice: { type: "number", description: "Leave out dishes above this price" },
        keywords: { type: "array", items: { type: "string" }, description: "Mark dishes matching these words" },
      },
    },
  },
  {
    name: "quote_cart",
    description: "Price a cart and estimate its delivery time without proposing it. Backed by POST /api/pricing/quote.",
    parameters: {
      type: "object",
      properties: { restaurantId: { type: "string" }, items: CART_ITEMS_SCHEMA },
      required: ["restaurantId", "items"],
    },
  },
  {
    name: "propose_cart",
    description: "Propose the final cart. The server checks it against the recorded spec and either accepts it or returns the failed checks.",
    parameters: {
      type: "object",
      properties: {
        restaurantId: { type: "string" },
        items: CART_ITEMS_SCHEMA,
        summary: { type: "string", description: "One sentence for the customer on why this cart fits" },
      },
      required: ["restaurantId", "items", "summary"],
    },
  },
  {
    name: "report_infeasible",
    description: "Say that no cart can satisfy the request, why, and the closest option.",
    parameters: {
      type: "object",
      properties: { reason: { type: "string" }, closestOption: { type: "string" } },
      required: ["reason"],
    },
  },
];

const rupees = (value) => `₹${Math.round(value)}`;

const describeSpec = (spec) =>
  [
    `${spec.partySize} ${spec.partySize === 1 ? "person" : "people"}`,
    spec.diet === "veg" ? "vegetarian" : null,
    spec.cuisines.length ? spec.cuisines.join("/") : null,
    spec.spice === "hot" ? "spicy" : spec.spice === "no_hot" ? "not spicy" : null,
    spec.budgetTotal ? `under ${rupees(spec.budgetTotal)}` : null,
    spec.maxDeliveryMinutes ? `within ${spec.maxDeliveryMinutes} min` : null,
    spec.include.length ? `with ${spec.include.join(", ")}` : null,
    spec.exclude.length ? `no ${spec.exclude.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

// The sentence shown with a proposal. Prices, times and counts come from the
// validated cart, never from model text: a model's own summary can state a
// wrong total. Its wording is kept only when it contains no figures.
const composeSummary = (result, modelSummary = "") => {
  const dishes = result.lines.reduce((sum, line) => sum + line.quantity, 0);
  const facts = `${dishes} ${dishes === 1 ? "dish" : "dishes"} from ${result.restaurant.name}, ${rupees(result.quote.totalAmount)} including tax and delivery, about ${result.eta.minutes} min.`;
  const why = String(modelSummary || "").trim();
  return why && !/[\d₹]|rs\.?\s|rupee/i.test(why) ? `${why.replace(/\.?$/, ".")} ${facts}` : facts;
};

const compactValidation = (result) => ({
  accepted: result.passed,
  total: result.quote?.totalAmount,
  deliveryMinutes: result.eta?.minutes,
  failedChecks: result.checks.filter((entry) => !entry.passed).map((entry) => `${entry.label}: ${entry.detail}`),
});

// ------------------------------------------------------------- LLM agent

const runLlmAgent = async ({ text, provider, onEvent }) => {
  const session = provider.createSession({ system: SYSTEM_PROMPT, tools: TOOLS });
  const trace = [];
  const usage = { inputTokens: 0, outputTokens: 0, modelCalls: 0 };
  const models = new Set();

  let spec = null;
  let corrections = [];
  let proposals = 0;
  let lastValidation = null;
  let outcome = null;

  const record = (step) => {
    trace.push({ at: new Date().toISOString(), ...step });
    onEvent?.({ type: "step", step });
  };

  const ensureSpec = () => {
    if (!spec) {
      // The model went straight to tools: fall back to the parsed request.
      ({ spec, corrections } = reconcileSpec(parseRequest(text).spec, text));
      record({ kind: "spec", summary: `Understood: ${describeSpec(spec)}`, spec, corrections, inferred: true });
    }
    return spec;
  };

  const handlers = {
    record_order_spec: async (args) => {
      const raw = { ...args, spice: args.spice === "none" ? null : args.spice };
      ({ spec, corrections } = reconcileSpec(raw, text));
      record({ kind: "spec", summary: `Understood: ${describeSpec(spec)}`, spec, corrections });
      return { recordedSpec: spec, corrections: corrections.map((entry) => `${entry.field} set to ${JSON.stringify(entry.to)} (${entry.reason})`) };
    },
    search_menus: async (args) => {
      const results = await searchMenus({
        cuisines: args.cuisines || [],
        vegOnly: Boolean(args.vegOnly),
        spicy: args.notSpicy ? false : null,
        maxItemPrice: args.maxItemPrice || null,
        keywords: args.keywords || [],
      });
      record({
        kind: "tool",
        tool: "search_menus",
        summary: `Searched menus${args.cuisines?.length ? ` (${args.cuisines.join(", ")})` : ""}${args.vegOnly ? ", veg only" : ""}: ${results.length} open restaurants`,
      });
      return { restaurants: results };
    },
    quote_cart: async (args) => {
      ensureSpec();
      try {
        const quote = await pricingService.quote({ restaurantId: args.restaurantId, items: args.items || [] });
        const itemCount = quote.lines.reduce((sum, line) => sum + line.quantity, 0);
        const eta = estimateOrderEta({ restaurant: quote.restaurant, itemCount });
        record({ kind: "tool", tool: "quote_cart", summary: `Priced a cart at ${quote.restaurant.name}: ${rupees(quote.totalAmount)}, about ${eta.minutes} min` });
        return { total: quote.totalAmount, subtotal: quote.subtotal, tax: quote.taxAmount, deliveryFee: quote.deliveryFee, deliveryMinutes: eta.minutes };
      } catch (error) {
        record({ kind: "tool", tool: "quote_cart", summary: `Pricing failed: ${error.message}` });
        return { error: error.message };
      }
    },
    propose_cart: async (args) => {
      ensureSpec();
      proposals += 1;
      const result = await validateCart({ spec, restaurantId: args.restaurantId, items: args.items || [] });
      lastValidation = { ...result, summary: result.passed ? composeSummary(result, args.summary) : "" };
      record({
        kind: "proposal",
        attempt: proposals,
        passed: result.passed,
        summary: result.passed
          ? `Proposal ${proposals} accepted: ${result.restaurant.name}, ${rupees(result.quote.totalAmount)}, about ${result.eta.minutes} min`
          : `Proposal ${proposals} rejected: ${result.checks.filter((entry) => !entry.passed).map((entry) => entry.detail).join("; ")}`,
        checks: result.checks,
      });
      if (result.passed) {
        outcome = { status: "proposed", validation: lastValidation };
        return { accepted: true };
      }
      if (proposals >= MAX_PROPOSALS) {
        outcome = { status: "failed", reason: "No valid cart after three attempts", validation: lastValidation };
        return { accepted: false, stop: true };
      }
      return { ...compactValidation(result), instruction: "Fix every failed check and propose again." };
    },
    report_infeasible: async (args) => {
      ensureSpec();
      // The explanation shown to the customer comes from the catalogue, not the
      // model: it only sees open restaurants, so it can say "nobody serves veg
      // biryani" when one closed restaurant does. Its wording is the fallback.
      const facts = diagnose(spec, await loadCatalog());
      const reason = facts.specific === false ? args.reason || facts.reason : facts.reason;
      const closestOption = facts.closestOption || args.closestOption || null;
      record({ kind: "infeasible", summary: `Can't be done: ${reason}` });
      outcome = { status: "declined", reason, closestOption };
      return { acknowledged: true };
    },
  };

  let turn = await session.send({ text: `Customer request: ${text}` });
  usage.modelCalls += 1;

  for (let index = 0; index < MAX_MODEL_TURNS && !outcome; index += 1) {
    models.add(turn.model);
    usage.inputTokens += turn.usage.inputTokens;
    usage.outputTokens += turn.usage.outputTokens;

    if (!turn.toolCalls.length) {
      // The model answered in prose: remind it how to finish, once.
      if (index > 0 && trace.some((step) => step.kind === "nudge")) break;
      record({ kind: "nudge", summary: "Asked the model to propose a cart or report that it can't" });
      turn = await session.send({ text: "Finish by calling propose_cart, or report_infeasible if no cart can satisfy the request." });
      usage.modelCalls += 1;
      continue;
    }

    const toolResults = [];
    for (const call of turn.toolCalls) {
      const handler = handlers[call.name];
      let output;
      try {
        output = handler ? await handler(call.args || {}) : { error: `Unknown tool ${call.name}` };
      } catch (error) {
        output = { error: error.message };
      }
      toolResults.push({ id: call.id, name: call.name, output });
      if (outcome) break;
    }
    if (outcome) break;

    turn = await session.send({ toolResults });
    usage.modelCalls += 1;
  }

  if (!outcome) {
    outcome = { status: "failed", reason: "The agent did not finish within its step limit", validation: lastValidation };
  }

  return { ...outcome, spec: ensureSpec(), corrections, proposals, trace, usage, models: [...models].filter(Boolean) };
};

// ------------------------------------------------------- rule-based agent

// Deterministic baseline (and the offline mode when no LLM key is set): parse
// the request with regular expressions, then build the cheapest valid cart.
const runRuleAgent = async ({ text, onEvent }) => {
  const trace = [];
  const record = (step) => {
    trace.push({ at: new Date().toISOString(), ...step });
    onEvent?.({ type: "step", step });
  };

  const { spec } = parseRequest(text);
  record({ kind: "spec", summary: `Understood: ${describeSpec(spec)}`, spec, corrections: [] });

  const catalog = await loadCatalog();
  const candidates = [];
  for (const { restaurant, items } of catalog) {
    if (!restaurant.isOpen || !restaurantMatchesCuisine(restaurant, spec)) continue;
    const cart = cheapestCart(spec, items, { preferMeals: true }) || cheapestCart(spec, items);
    if (!cart) continue;
    const eta = estimateOrderEta({ restaurant, itemCount: cart.items.reduce((sum, line) => sum + line.quantity, 0) });
    candidates.push({ restaurant, cart, eta });
  }
  record({ kind: "tool", tool: "search_menus", summary: `${candidates.length} restaurants can make a cart that fits` });

  const ranked = candidates
    .filter((candidate) => !spec.maxDeliveryMinutes || candidate.eta.minutes <= spec.maxDeliveryMinutes)
    .sort((a, b) => a.cart.subtotal - b.cart.subtotal || a.eta.minutes - b.eta.minutes);

  let proposals = 0;
  for (const candidate of ranked.slice(0, MAX_PROPOSALS)) {
    proposals += 1;
    const result = await validateCart({ spec, restaurantId: String(candidate.restaurant._id), items: candidate.cart.items });
    record({
      kind: "proposal",
      attempt: proposals,
      passed: result.passed,
      summary: result.passed
        ? `Proposal ${proposals} accepted: ${result.restaurant.name}, ${rupees(result.quote.totalAmount)}`
        : `Proposal ${proposals} rejected: ${result.checks.filter((entry) => !entry.passed).map((entry) => entry.detail).join("; ")}`,
      checks: result.checks,
    });
    if (result.passed) {
      return {
        status: "proposed",
        validation: { ...result, summary: `The lowest-priced cart at ${result.restaurant.name} that meets the request.` },
        spec,
        corrections: [],
        proposals,
        trace,
        usage: { inputTokens: 0, outputTokens: 0, modelCalls: 0 },
        models: [],
      };
    }
  }

  // Name the constraint that rules everything out, and the closest alternative.
  const { reason, closestOption } = diagnose(spec, catalog);
  record({ kind: "infeasible", summary: `Can't be done: ${reason}` });
  return {
    status: "declined",
    reason,
    closestOption,
    spec,
    corrections: [],
    proposals,
    trace,
    usage: { inputTokens: 0, outputTokens: 0, modelCalls: 0 },
    models: [],
  };
};

/**
 * Plans an order from a natural-language request.
 * @returns {Promise<{ status: "proposed"|"declined"|"failed", validation?, reason?, spec, trace, usage, engine, latencyMs }>}
 */
const PROVIDER_LABELS = { groq: "Groq", gemini: "Gemini", openai: "OpenAI" };
const label = (provider) => PROVIDER_LABELS[provider.name] || provider.name;

const planOrder = async ({ text, provider: providerOverride, providers: providerList, onEvent } = {}) => {
  const started = Date.now();
  const request = String(text || "").trim().slice(0, 500);

  // An explicit provider (tests, evaluation) is used alone; otherwise every
  // configured provider is tried in order, skipping ones whose key was rejected.
  const candidates = providerList || (providerOverride === undefined ? resolveProviders() : [providerOverride]);
  const providers = candidates.filter((provider) => provider && !isCoolingDown(provider.name));

  const failures = [];
  for (const [index, provider] of providers.entries()) {
    try {
      const result = await runLlmAgent({ text: request, provider, onEvent });
      return {
        ...result,
        request,
        engine: provider.name,
        fallbackReason: failures.length ? failures.join("; ") : null,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      if (isAuthError(error)) markAuthFailure(provider.name);
      failures.push(`${label(provider)}: ${error.message}`);
      const next = providers[index + 1];
      onEvent?.({
        type: "step",
        step: {
          kind: "fallback",
          summary: `${label(provider)} is unavailable${isAuthError(error) ? " (its API key was rejected)" : ""}; ${
            next ? `trying ${label(next)}` : "using the rule-based planner"
          }`,
        },
      });
    }
  }

  // No provider configured, or all of them failed: the deterministic planner.
  const result = await runRuleAgent({ text: request, onEvent });
  return {
    ...result,
    request,
    engine: "rules",
    fallbackReason: failures.length ? failures.join("; ") : null,
    latencyMs: Date.now() - started,
  };
};

module.exports = {
  TOOLS,
  SYSTEM_PROMPT,
  planOrder,
  runLlmAgent,
  runRuleAgent,
  describeSpec,
};
