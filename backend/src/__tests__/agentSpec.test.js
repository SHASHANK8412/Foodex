// The deterministic request parser and the reconciliation that validates the
// LLM's reading of a request. No database needed.
const { parseRequest, reconcileSpec, normalizeSpec } = require("../agent/orderSpec");

const parse = (text) => parseRequest(text).spec;

describe("parseRequest", () => {
  test("reads the headline example", () => {
    expect(parse("Something spicy and veg for 3 people, under ₹600, delivered in 30 minutes")).toEqual({
      diet: "veg",
      cuisines: [],
      spice: "hot",
      partySize: 3,
      budgetTotal: 600,
      maxDeliveryMinutes: 30,
      include: [],
      exclude: [],
    });
  });

  test.each([
    ["dinner for 4", 4],
    ["family of five", 5],
    ["me and my wife", 2],
    ["italian for me and my wife", 2],
    ["me and 2 friends", 3],
    ["3 colleagues and me", 4],
    ["my 2 kids and me", 3],
    ["the two of us", 2],
    ["just me tonight", 1],
    ["6 friends coming over", 6],
    ["lunch", 1],
    ["three pizzas for a party", 1],
  ])("party size in %p is %p", (text, size) => {
    expect(parse(text).partySize).toBe(size);
  });

  test.each([
    ["under ₹600", 600],
    ["budget of 1.5k", 1500],
    ["rs 450 max", 450],
    ["about 800 rupees", 800],
    ["₹150 each for 4 people", 600],
    ["for 4 people under 30 minutes", null],
  ])("budget in %p is %p", (text, budget) => {
    expect(parse(text).budgetTotal).toBe(budget);
  });

  test.each([
    ["in 30 minutes", 30],
    ["within 45 mins", 45],
    ["in half an hour", 30],
    ["within an hour", 60],
    ["no rush", null],
  ])("delivery time in %p is %p", (text, minutes) => {
    expect(parse(text).maxDeliveryMinutes).toBe(minutes);
  });

  test("distinguishes vegetarian from non-veg", () => {
    expect(parse("pure veg please").diet).toBe("veg");
    expect(parse("my friend is vegetarian").diet).toBe("veg");
    expect(parse("non-veg is fine").diet).toBe("any");
  });

  test("reads spice preferences, including negations", () => {
    expect(parse("something fiery").spice).toBe("hot");
    expect(parse("not too spicy please").spice).toBe("no_hot");
    expect(parse("mild food for my kids").spice).toBe("no_hot");
  });

  test("dishes are required dishes, not cuisines", () => {
    const spec = parse("biryani and a dessert");
    expect(spec.cuisines).toEqual([]);
    expect(spec.include).toEqual(expect.arrayContaining(["biryani", "dessert"]));
  });

  test("named cuisines map to catalogue labels", () => {
    expect(parse("chinese for 2").cuisines).toEqual(["Chinese"]);
    expect(parse("a south indian breakfast").cuisines).toEqual(["South Indian"]);
  });

  test("exclusions are not mistaken for requests", () => {
    const spec = parse("pizza without mushrooms, no paneer");
    expect(spec.exclude).toEqual(expect.arrayContaining(["mushroom", "paneer"]));
    expect(spec.include).toEqual(["pizza"]);
  });
});

describe("reconcileSpec (validating the LLM's spec)", () => {
  const text = "Something spicy and veg for 3 people, under ₹600, delivered in 30 minutes";

  test("keeps an LLM spec that agrees with the request", () => {
    const { spec, corrections } = reconcileSpec(
      { diet: "veg", spice: "hot", partySize: 3, budgetTotal: 600, maxDeliveryMinutes: 30 },
      text
    );
    expect(corrections).toEqual([]);
    expect(spec.budgetTotal).toBe(600);
  });

  test("overrides misread numbers with the ones stated in the request", () => {
    const { spec, corrections } = reconcileSpec(
      { diet: "veg", spice: "hot", partySize: 1, budgetTotal: 6000, maxDeliveryMinutes: 60 },
      text
    );
    expect(spec).toEqual(expect.objectContaining({ partySize: 3, budgetTotal: 600, maxDeliveryMinutes: 30 }));
    expect(corrections.map((entry) => entry.field).sort()).toEqual(["budgetTotal", "maxDeliveryMinutes", "partySize"]);
  });

  test("restores a dropped vegetarian constraint and dropped exclusions", () => {
    const { spec, corrections } = reconcileSpec({ diet: "any", partySize: 2 }, "veg pizza for two, no mushrooms");
    expect(spec.diet).toBe("veg");
    expect(spec.exclude).toContain("mushroom");
    expect(corrections.map((entry) => entry.field)).toEqual(expect.arrayContaining(["diet", "exclude"]));
  });

  test("leaves the party size alone when the request doesn't state one", () => {
    // Regression: "for a party" used to parse as one person and override the model.
    const { spec, corrections } = reconcileSpec({ partySize: 3, include: ["pizza"] }, "Three pizzas for a party, under ₹1000");
    expect(spec.partySize).toBe(3);
    expect(corrections.map((entry) => entry.field)).not.toContain("partySize");
  });

  test("never loosens a constraint the LLM inferred", () => {
    // The text has no explicit budget; the LLM's reading of "cheap" is kept.
    const { spec } = reconcileSpec({ diet: "any", partySize: 2, budgetTotal: 400 }, "something cheap for two");
    expect(spec.budgetTotal).toBe(400);
  });

  test("normalizeSpec clamps and cleans model output", () => {
    expect(
      normalizeSpec({ diet: "VEG", partySize: 99, budgetTotal: -5, cuisines: ["chinese", "Martian"], include: "Pizza, Fries" })
    ).toEqual(expect.objectContaining({ diet: "any", partySize: 20, budgetTotal: null, cuisines: ["Chinese"], include: ["pizza", "fries"] }));
  });
});

describe("tool schemas for LLM providers", () => {
  const { withNullableOptionals } = require("../agent/llm/providers");
  const { TOOLS } = require("../agent/orderingAgent");
  const search = TOOLS.find((tool) => tool.name === "search_menus").parameters;
  const propose = TOOLS.find((tool) => tool.name === "propose_cart").parameters;

  test("optional parameters accept null for OpenAI-compatible providers (Groq rejects null otherwise)", () => {
    const schema = withNullableOptionals(search, "openai");
    expect(schema.properties.maxItemPrice.type).toEqual(["number", "null"]);
    expect(schema.properties.vegOnly.type).toEqual(["boolean", "null"]);
  });

  test("required parameters stay strict", () => {
    const schema = withNullableOptionals(propose, "openai");
    expect(schema.properties.restaurantId.type).toBe("string");
    expect(schema.properties.items.items.properties.quantity.type).toBe("integer");
  });

  test("Gemini gets its own nullable flag", () => {
    expect(withNullableOptionals(search, "gemini").properties.maxItemPrice).toEqual(expect.objectContaining({ type: "number", nullable: true }));
  });
});
