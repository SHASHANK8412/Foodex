// The ordering agent end to end on the seeded demo catalogue: the validator,
// the LLM loop (with a scripted fake model, so the behaviour under test is ours,
// not a real model's), the rule-based agent, and confirmation over HTTP.

const harness = require("./helpers/testServer");
const request = require("supertest");

const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const Restaurant = require("../models/Restaurant");
const AgentProposal = require("../models/AgentProposal");
const { seedDemoData } = require("../seeders/demoData");
const { planOrder, TOOLS } = require("../agent/orderingAgent");
const { validateCart } = require("../agent/validator");
const { normalizeSpec } = require("../agent/orderSpec");

jest.setTimeout(120000);

let app;
let catalog;

beforeAll(async () => {
  app = await harness.start();
  await seedDemoData({ force: true });
  const restaurants = await Restaurant.find({}).lean();
  const items = await MenuItem.find({}).lean();
  catalog = {
    restaurant: (name) => restaurants.find((entry) => entry.name === name),
    item: (name) => items.find((entry) => entry.name === name),
  };
});

afterAll(async () => {
  await harness.stop();
});

const line = (name, quantity = 1) => ({ menuItemId: String(catalog.item(name)._id), quantity });

// A fake LLM provider that plays back a script. Each step receives the tool
// results from the previous turn, so it can use real ids from search_menus.
const scriptedProvider = (script) => {
  const calls = [];
  return {
    name: "scripted",
    calls,
    createSession: () => {
      let step = 0;
      return {
        send: async (input) => {
          calls.push(input);
          const next = script[step] || (() => ({ toolCalls: [] }));
          step += 1;
          const turn = typeof next === "function" ? next(input.toolResults || []) : next;
          return {
            model: "scripted-model",
            text: turn.text || "",
            toolCalls: (turn.toolCalls || []).map((call, index) => ({ id: `c${step}_${index}`, ...call })),
            usage: { inputTokens: 100, outputTokens: 20 },
          };
        },
      };
    },
  };
};

const headline = "Something spicy and veg for 3 people, under ₹600, delivered in 30 minutes";

describe("validateCart", () => {
  const spec = normalizeSpec({ diet: "veg", spice: "hot", partySize: 3, budgetTotal: 600, maxDeliveryMinutes: 30 });

  test("accepts a cart that meets every constraint", async () => {
    const result = await validateCart({
      spec,
      restaurantId: String(catalog.restaurant("Dosa Junction")._id),
      items: [line("Mysore Masala Dosa", 2), line("Masala Dosa", 1)],
    });

    expect(result.passed).toBe(true);
    expect(result.checks.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["restaurant_open", "items", "diet", "spice", "party_size", "budget", "delivery_time"])
    );
    expect(result.eta.minutes).toBeLessThanOrEqual(30);
  });

  test("reports every failed constraint at once", async () => {
    const result = await validateCart({
      spec,
      restaurantId: String(catalog.restaurant("Urban Spice Kitchen")._id),
      items: [line("Butter Chicken", 2)],
    });
    const failed = result.checks.filter((entry) => !entry.passed).map((entry) => entry.id);

    expect(result.passed).toBe(false);
    expect(failed).toEqual(expect.arrayContaining(["diet", "spice", "party_size", "delivery_time"]));
  });

  test("rejects a closed restaurant and dishes from another menu", async () => {
    const closed = await validateCart({ spec, restaurantId: String(catalog.restaurant("Midnight Biryani")._id), items: [line("Veg Dum Biryani", 3)] });
    const foreign = await validateCart({ spec, restaurantId: String(catalog.restaurant("Dosa Junction")._id), items: [line("Pani Puri", 3)] });

    expect(closed.checks.find((entry) => entry.id === "restaurant_open").passed).toBe(false);
    expect(foreign.checks.find((entry) => entry.id === "items").passed).toBe(false);
  });

  test("drinks do not count as a person's dish", async () => {
    const result = await validateCart({
      spec: normalizeSpec({ partySize: 2 }),
      restaurantId: String(catalog.restaurant("Dosa Junction")._id),
      items: [line("Masala Dosa", 1), line("Filter Coffee", 3)],
    });
    expect(result.checks.find((entry) => entry.id === "party_size").passed).toBe(false);
  });
});

describe("LLM agent loop", () => {
  test("re-plans after the validator rejects an over-budget cart", async () => {
    const dosa = () => String(catalog.restaurant("Dosa Junction")._id);
    const provider = scriptedProvider([
      {
        toolCalls: [
          { name: "record_order_spec", args: { diet: "veg", spice: "hot", partySize: 3, budgetTotal: 600, maxDeliveryMinutes: 30 } },
          { name: "search_menus", args: { vegOnly: true } },
        ],
      },
      // First attempt: far too much food.
      { toolCalls: [{ name: "propose_cart", args: { restaurantId: dosa(), items: [line("Mysore Masala Dosa", 5)], summary: "Lots of dosa" } }] },
      (results) => {
        // The rejection reaches the model with the reasons.
        expect(results[0].output.accepted).toBe(false);
        expect(results[0].output.failedChecks.join(" ")).toMatch(/over budget/);
        return { toolCalls: [{ name: "propose_cart", args: { restaurantId: dosa(), items: [line("Mysore Masala Dosa", 2), line("Masala Dosa", 1)], summary: "Two spicy dosas and one regular" } }] };
      },
    ]);

    const result = await planOrder({ text: headline, provider });

    expect(result.status).toBe("proposed");
    expect(result.proposals).toBe(2);
    expect(result.engine).toBe("scripted");
    expect(result.validation.passed).toBe(true);
    expect(result.trace.filter((step) => step.kind === "proposal").map((step) => step.passed)).toEqual([false, true]);
    // The model's wording is kept (it has no figures); the facts come from the validated cart.
    expect(result.validation.summary).toMatch(/^Two spicy dosas and one regular\. 3 dishes from Dosa Junction, ₹\d+ including tax/);
  });

  test("never shows figures the model wrote in its summary", async () => {
    const dosa = () => String(catalog.restaurant("Dosa Junction")._id);
    const provider = scriptedProvider([
      { toolCalls: [{ name: "record_order_spec", args: { diet: "veg", spice: "hot", partySize: 3, budgetTotal: 600, maxDeliveryMinutes: 30 } }] },
      {
        toolCalls: [
          {
            name: "propose_cart",
            args: { restaurantId: dosa(), items: [line("Mysore Masala Dosa", 2), line("Masala Dosa", 1)], summary: "Only ₹99 in total, here in 5 minutes!" },
          },
        ],
      },
    ]);

    const result = await planOrder({ text: headline, provider });

    expect(result.validation.summary).not.toMatch(/₹99|5 minutes/);
    expect(result.validation.summary).toContain(`₹${Math.round(result.validation.quote.totalAmount)}`);
  });

  test("corrects a misread spec before validating against it", async () => {
    const provider = scriptedProvider([
      {
        toolCalls: [
          // The model misreads ₹600 as 6000 and drops the time limit.
          { name: "record_order_spec", args: { diet: "veg", spice: "hot", partySize: 3, budgetTotal: 6000 } },
          { name: "search_menus", args: {} },
        ],
      },
      {
        toolCalls: [
          {
            name: "propose_cart",
            args: { restaurantId: String(catalog.restaurant("Urban Spice Kitchen")._id), items: [line("Veg Kolhapuri", 3), line("Butter Naan", 3)], summary: "" },
          },
        ],
      },
      { toolCalls: [{ name: "report_infeasible", args: { reason: "giving up" } }] },
    ]);

    const result = await planOrder({ text: headline, provider });

    expect(result.spec).toEqual(expect.objectContaining({ budgetTotal: 600, maxDeliveryMinutes: 30 }));
    expect(result.corrections.map((entry) => entry.field)).toEqual(expect.arrayContaining(["budgetTotal", "maxDeliveryMinutes"]));
    // ₹918 and 43 minutes would have passed the model's version of the spec.
    const rejection = result.trace.find((step) => step.kind === "proposal");
    expect(rejection.passed).toBe(false);
    expect(rejection.checks.filter((entry) => !entry.passed).map((entry) => entry.id)).toEqual(expect.arrayContaining(["budget", "delivery_time"]));
  });

  test("stops after three rejected proposals", async () => {
    const bad = { name: "propose_cart", args: { restaurantId: String(catalog.restaurant("Urban Spice Kitchen")._id), items: [line("Butter Chicken", 1)], summary: "" } };
    const provider = scriptedProvider([
      { toolCalls: [{ name: "record_order_spec", args: { diet: "veg", partySize: 3 } }] },
      { toolCalls: [bad] },
      { toolCalls: [bad] },
      { toolCalls: [bad] },
      { toolCalls: [bad] },
    ]);

    const result = await planOrder({ text: headline, provider });

    expect(result.status).toBe("failed");
    expect(result.proposals).toBe(3);
  });

  test("falls back to the rule-based planner when the model is unavailable", async () => {
    const provider = {
      name: "broken",
      createSession: () => ({
        send: async () => {
          throw new Error("503 model overloaded");
        },
      }),
    };

    const result = await planOrder({ text: headline, provider });

    expect(result.engine).toBe("rules");
    expect(result.fallbackReason).toMatch(/overloaded/);
    expect(result.status).toBe("proposed");
  });

  test("has no tool that can order or pay, and planning creates no order", async () => {
    const before = await Order.countDocuments();
    await planOrder({ text: headline, provider: null });

    expect(TOOLS.map((tool) => tool.name).sort()).toEqual(["propose_cart", "quote_cart", "record_order_spec", "report_infeasible", "search_menus"]);
    expect(await Order.countDocuments()).toBe(before);
  });
});

describe("provider failover", () => {
  const { resetAuthFailures } = require("../agent/llm/providers");
  afterEach(() => resetAuthFailures());

  const expiredKey = (name) => ({
    name,
    createSession: () => ({
      send: async () => {
        throw Object.assign(new Error("401 Invalid API Key"), { status: 401 });
      },
    }),
  });

  const workingProvider = (name) => {
    const provider = scriptedProvider([
      { toolCalls: [{ name: "record_order_spec", args: { diet: "veg", spice: "hot", partySize: 3, budgetTotal: 600, maxDeliveryMinutes: 30 } }] },
      {
        toolCalls: [
          {
            name: "propose_cart",
            args: { restaurantId: String(catalog.restaurant("Dosa Junction")._id), items: [line("Mysore Masala Dosa", 2), line("Masala Dosa", 1)], summary: "" },
          },
        ],
      },
    ]);
    return { ...provider, name };
  };

  test("an expired key moves on to the next provider, not straight to the rule-based planner", async () => {
    const steps = [];
    const result = await planOrder({
      text: headline,
      providers: [expiredKey("groq"), workingProvider("gemini")],
      onEvent: (event) => steps.push(event.step?.summary),
    });

    expect(result.engine).toBe("gemini");
    expect(result.status).toBe("proposed");
    expect(result.fallbackReason).toMatch(/groq: 401 Invalid API Key/i);
    expect(steps).toContain("Groq is unavailable (its API key was rejected); trying Gemini");
  });

  test("a provider whose key was rejected is skipped on the next request", async () => {
    const groq = expiredKey("groq");
    const sends = jest.spyOn(groq, "createSession");
    await planOrder({ text: headline, providers: [groq, workingProvider("gemini")] });
    await planOrder({ text: headline, providers: [groq, workingProvider("gemini")] });

    expect(sends).toHaveBeenCalledTimes(1);
  });

  test("uses the rule-based planner only when every provider fails", async () => {
    const result = await planOrder({ text: headline, providers: [expiredKey("groq"), expiredKey("gemini")] });

    expect(result.engine).toBe("rules");
    expect(result.status).toBe("proposed");
  });
});

describe("explaining requests that can't be done", () => {
  test("names the closed restaurant and offers what is available", async () => {
    const result = await planOrder({ text: "I want veg biryani", provider: null });

    expect(result.status).toBe("declined");
    expect(result.reason).toBe("Veg Dum Biryani is only on the menu at Midnight Biryani, which is closed right now.");
    expect(result.closestOption).toBe("Chicken Biryani at Urban Spice Kitchen is available now, but it isn't vegetarian.");
  });

  test("says when a dish doesn't exist at all", async () => {
    const result = await planOrder({ text: "sushi for two", provider: null });
    expect(result.status).toBe("proposed"); // "sushi" is not a known dish word, so the parser ignores it

    const { diagnose } = require("../agent/diagnose");
    const { loadCatalog } = require("../agent/catalog");
    expect(diagnose(normalizeSpec({ include: ["sushi"] }), await loadCatalog()).reason).toBe('Nothing on Foodex matches "sushi".');
  });

  test("gives the fastest possible time when the deadline is too tight", async () => {
    const result = await planOrder({ text: "veg food for 3 delivered in 20 minutes", provider: null });

    expect(result.reason).toMatch(/^Nothing can arrive within 20 minutes; the fastest is about \d+ minutes\.$/);
    expect(result.closestOption).toMatch(/can deliver in about \d+ min for ₹\d+/);
  });

  test("gives the cheapest possible total when the budget is too low", async () => {
    const result = await planOrder({ text: "dinner for 4 under ₹100", provider: null });

    expect(result.reason).toMatch(/^The cheapest cart that fits is ₹\d+ \(tax and delivery included\), above your ₹100 budget\.$/);
  });
});

describe("explanations when the LLM declines", () => {
  test("the customer sees the catalogue's facts, not the model's guess", async () => {
    const provider = scriptedProvider([
      { toolCalls: [{ name: "record_order_spec", args: { diet: "veg", partySize: 1, include: ["biryani"] } }] },
      { toolCalls: [{ name: "report_infeasible", args: { reason: "No restaurant offers veg biryani.", closestOption: "Try curd rice." } }] },
    ]);

    const result = await planOrder({ text: "I want veg biryani", provider });

    expect(result.reason).toBe("Veg Dum Biryani is only on the menu at Midnight Biryani, which is closed right now.");
    expect(result.closestOption).toBe("Chicken Biryani at Urban Spice Kitchen is available now, but it isn't vegetarian.");
  });

  test("keeps the model's wording when no single constraint explains it", async () => {
    const provider = scriptedProvider([
      { toolCalls: [{ name: "record_order_spec", args: { partySize: 1 } }] },
      { toolCalls: [{ name: "report_infeasible", args: { reason: "The model's own reason." } }] },
    ]);

    const result = await planOrder({ text: "something", provider });

    expect(result.reason).toBe("The model's own reason.");
  });
});

describe("rule-based agent", () => {
  test.each([
    ["Something spicy and veg for 3 people, under ₹600, delivered in 30 minutes", "proposed"],
    ["pizza for two under ₹900", "proposed"],
    ["veg food for 3 delivered in 20 minutes", "declined"], // nothing is that fast
    ["dinner for 4 under ₹100", "declined"], // below the cheapest possible order
  ])("%p is %p", async (text, status) => {
    const result = await planOrder({ text, provider: null });
    expect(result.status).toBe(status);
    if (status === "proposed") expect(result.validation.passed).toBe(true);
  });
});

describe("plan and confirm over HTTP", () => {
  const address = { line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", postalCode: "560001" };

  const login = async (email, password) => (await request(app).post("/api/auth/login").send({ email, password })).body.data.token;

  const planAs = async (token, text = headline) =>
    request(app).post("/api/agent/plan").set("Authorization", `Bearer ${token}`).send({ request: text });

  test("requires sign-in", async () => {
    const response = await request(app).post("/api/agent/plan").send({ request: headline });
    expect(response.status).toBe(401);
  });

  test("planning returns a proposal; confirming creates the order at the proposed total", async () => {
    const token = await login("user@foodex.com", "user123");

    const planned = await planAs(token);
    expect(planned.status).toBe(200);
    expect(planned.body.data).toEqual(expect.objectContaining({ status: "proposed", engine: "rules" }));
    expect(await Order.countDocuments({ "deliveryAddress.line1": address.line1 })).toBe(0);

    const proposal = planned.body.data;
    const confirmed = await request(app)
      .post(`/api/agent/proposals/${proposal.id}/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({ deliveryAddress: address });

    expect(confirmed.status).toBe(201);
    expect(confirmed.body.data.order.totalAmount).toBe(proposal.quote.totalAmount);
    expect(confirmed.body.data.payment.isMock).toBe(true);

    const again = await request(app)
      .post(`/api/agent/proposals/${proposal.id}/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({ deliveryAddress: address });
    expect(again.status).toBe(409); // never ordered twice
  });

  test("streams the agent's steps as Server-Sent Events", async () => {
    const token = await login("user@foodex.com", "user123");

    const response = await request(app)
      .post("/api/agent/plan?stream=1")
      .set("Authorization", `Bearer ${token}`)
      .send({ request: "pizza for two under ₹900" });

    expect(response.headers["content-type"]).toMatch(/text\/event-stream/);
    const events = response.text
      .split("\n\n")
      .filter((block) => block.startsWith("data: "))
      .map((block) => JSON.parse(block.slice(6)));
    expect(events.filter((event) => event.type === "step").length).toBeGreaterThan(1);
    expect(events.at(-1)).toEqual(expect.objectContaining({ type: "result", proposal: expect.objectContaining({ status: "proposed" }) }));
  });

  test("only the customer who asked can see or confirm a proposal", async () => {
    const owner = await login("user@foodex.com", "user123");
    const other = await login("admin@foodex.com", "admin123");
    const proposal = (await planAs(owner)).body.data;

    const read = await request(app).get(`/api/agent/proposals/${proposal.id}`).set("Authorization", `Bearer ${other}`);
    const confirm = await request(app)
      .post(`/api/agent/proposals/${proposal.id}/confirm`)
      .set("Authorization", `Bearer ${other}`)
      .send({ deliveryAddress: address });

    expect(read.status).toBe(404);
    expect(confirm.status).toBe(404);
  });

  test("a price change between proposal and confirmation asks the customer to review", async () => {
    const token = await login("user@foodex.com", "user123");
    const proposal = (await planAs(token)).body.data;

    const firstItem = proposal.items[0];
    await MenuItem.updateOne({ _id: firstItem.menuItemId }, { $inc: { price: 10 } });

    const confirmed = await request(app)
      .post(`/api/agent/proposals/${proposal.id}/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({ deliveryAddress: address });

    await MenuItem.updateOne({ _id: firstItem.menuItemId }, { $inc: { price: -10 } });
    expect(confirmed.status).toBe(409);
    expect(confirmed.body.message).toMatch(/price changed/i);
  });

  test("a cart that no longer meets the request is not ordered", async () => {
    const token = await login("user@foodex.com", "user123");
    const proposal = (await planAs(token)).body.data;

    await Restaurant.updateOne({ _id: proposal.restaurant.id }, { isOpen: false });
    const confirmed = await request(app)
      .post(`/api/agent/proposals/${proposal.id}/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({ deliveryAddress: address });
    await Restaurant.updateOne({ _id: proposal.restaurant.id }, { isOpen: true });

    expect(confirmed.status).toBe(409);
    expect(confirmed.body.details.map((entry) => entry.id)).toContain("restaurant_open");
  });

  test("expired proposals cannot be confirmed", async () => {
    const token = await login("user@foodex.com", "user123");
    const proposal = (await planAs(token)).body.data;
    await AgentProposal.updateOne({ _id: proposal.id }, { expiresAt: new Date(Date.now() - 1000) });

    const confirmed = await request(app)
      .post(`/api/agent/proposals/${proposal.id}/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({ deliveryAddress: address });

    expect(confirmed.status).toBe(410);
  });
});
