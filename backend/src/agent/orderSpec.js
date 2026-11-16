// The order spec: the constraints a request puts on a cart.
//
//   diet               "veg" | "any"
//   cuisines           catalogue cuisine labels the restaurant must have (any of)
//   spice              "hot" (at least one hot dish) | "no_hot" (none) | null
//   partySize          people to feed; each needs a dish (beverages do not count)
//   budgetTotal        maximum payable in rupees, tax and delivery included, or null
//   maxDeliveryMinutes latest acceptable delivery time, or null
//   include            dish keywords that must appear in the cart (each one)
//   exclude            ingredient/dish keywords that must not appear
//
// The LLM extracts the spec; `parseRequest` is a deterministic parser used to
// cross-check it (see reconcileSpec) and, on its own, as the rule-based agent.

const CUISINES = [
  "Indian",
  "North Indian",
  "South Indian",
  "Street Food",
  "Chinese",
  "Asian",
  "Italian",
  "Continental",
  "Burgers",
  "American",
  "Fast Food",
  "Healthy",
  "Salads",
  "Desserts",
  "Bakery",
  "Biryani",
  "Hyderabadi",
];

// Phrases in a request that name a cuisine.
const CUISINE_WORDS = [
  [/\bnorth[- ]indian\b|\bpunjabi\b/, "North Indian"],
  [/\bsouth[- ]indian\b|\bdosas?\b|\bidlis?\b|\btiffin\b/, "South Indian"],
  [/\bstreet[- ]food\b|\bchaat\b/, "Street Food"],
  [/\bchinese\b|\bindo[- ]chinese\b/, "Chinese"],
  [/\bitalian\b/, "Italian"],
  [/\bburgers?\b|\bfast[- ]food\b/, "Burgers"],
  [/\bhealthy\b|\blow[- ]cal(orie)?\b/, "Healthy"],
  [/\bdessert (place|shop|restaurant)\b|\bbakery\b/, "Desserts"],
];
// Dishes such as biryani, salad or dessert are not cuisines: several
// restaurants serve them, so they become required dishes (DISH_WORDS) instead.

// Dish words that become `include` keywords when mentioned.
const DISH_WORDS = [
  "pizza", "pasta", "biryani", "dosa", "idli", "noodles", "fried rice", "burger", "fries", "brownie",
  "naan", "paneer", "salad", "wrap", "soup", "coffee", "chai", "shake", "juice", "waffle", "cheesecake",
  "wings", "pav bhaji", "garlic bread", "risotto", "tofu", "samosa", "vada", "uttapam", "rasmalai",
  "gulab jamun", "tiramisu", "spring rolls", "manchurian", "dessert",
];

const EXCLUDABLE = [
  "mushroom", "paneer", "onion", "garlic", "dairy", "cheese", "peanut", "nut", "chicken", "pork", "egg",
  "fried", "potato", "tofu", "coffee", "chocolate", "mango", "chickpeas",
];

// "a" and "an" are deliberately absent: "for a party" says nothing about size.
const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
  couple: 2, pair: 2,
};

const clampInt = (value, min, max) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : null;
};

const asList = (value) =>
  (Array.isArray(value) ? value : typeof value === "string" && value ? value.split(",") : [])
    .map((entry) => String(entry).trim().toLowerCase())
    .filter(Boolean);

const canonicalCuisine = (value) => {
  const lower = String(value || "").trim().toLowerCase();
  return CUISINES.find((cuisine) => cuisine.toLowerCase() === lower) || null;
};

const uniq = (list) => [...new Set(list)];

// Brings any spec-like object (from the LLM or the parser) into the canonical shape.
const normalizeSpec = (raw = {}) => {
  const budget = Number(raw.budgetTotal);
  const minutes = Number(raw.maxDeliveryMinutes);
  const spice = ["hot", "no_hot"].includes(raw.spice) ? raw.spice : null;

  return {
    diet: raw.diet === "veg" ? "veg" : "any",
    cuisines: uniq(asList(raw.cuisines).map(canonicalCuisine).filter(Boolean)),
    spice,
    partySize: clampInt(raw.partySize, 1, 20) || 1,
    budgetTotal: Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) / 100 : null,
    maxDeliveryMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null,
    include: uniq(asList(raw.include)),
    exclude: uniq(asList(raw.exclude)),
  };
};

const parseAmount = (digits, suffix) => {
  const value = Number(String(digits).replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  return /^k$/i.test(suffix || "") ? value * 1000 : value;
};

const toCount = (token) => (/^\d+$/.test(token) ? Number(token) : NUMBER_WORDS[token]);

const GROUP_NOUNS = "friends|kids|children|colleagues|others|guests|people|coworkers|cousins|roommates";

const findPartySize = (text) => {
  // "me and 2 friends", "3 colleagues and me": the speaker plus the group.
  const plusMe =
    text.match(new RegExp(`\\b(?:me|i) (?:and|&|with|plus) (?:my )?(\\d+|[a-z]+) (?:${GROUP_NOUNS})\\b`)) ||
    text.match(new RegExp(`\\b(\\d+|[a-z]+) (?:${GROUP_NOUNS}) (?:and|&|plus) (?:me|i|myself)\\b`)) ||
    text.match(new RegExp(`\\bmy (\\d+|[a-z]+) (?:${GROUP_NOUNS}) and (?:me|i)\\b`));
  if (plusMe) {
    const count = toCount(plusMe[1]);
    if (count && count < 20) return count + 1;
  }

  // Two people, checked before "for me" so "for me and my wife" is two.
  if (/\b(me and my|me & my|the two of us|two of us|both of us|for two|for 2|couple|my (wife|husband|partner|friend|girlfriend|boyfriend) and (me|i))\b/.test(text)) {
    return 2;
  }
  if (/\b(just me|for me|for myself|only me|solo|by myself|for one)\b/.test(text)) return 1;

  const patterns = [
    /\b(?:family|team|group|party) of (\d+|[a-z]+)\b/,
    /\b(\d+|[a-z]+)\s*(?:people|persons|pax|adults|friends|guests|of us|heads)\b/,
    /\bfor (\d+|[a-z]+)\b(?!\s*(?:₹|rs|rupees|inr|minutes|mins?|min|hours?|hrs?|bucks|k\b))/,
    /\bfeeds? (\d+|[a-z]+)\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = toCount(match[1]);
      if (value && value >= 1 && value <= 20) return value;
    }
  }
  return null;
};

const findMinutes = (text) => {
  if (/\bhalf an hour\b|\bhalf-hour\b/.test(text)) return 30;
  if (/\b(an|one|1) hour and a half\b|\b1\.5 hours?\b|\b90 min/.test(text)) return 90;
  if (/\b(an|one|1) hour\b|\bwithin the hour\b/.test(text)) return 60;
  if (/\b(quick|fast|asap|hurry|quickly)\b/.test(text) && !/\b\d+\s*(?:minutes|mins?|min)\b/.test(text)) return null;
  const match = text.match(/\b(\d{1,3})\s*(?:-\s*)?(?:minutes|mins?|min)\b/);
  if (match) return Number(match[1]);
  const hours = text.match(/\b(\d)\s*(?:hours?|hrs?)\b/);
  return hours ? Number(hours[1]) * 60 : null;
};

const findBudget = (text, partySize) => {
  const money = [
    /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(k)?\b/,
    /\b([\d,]+(?:\.\d+)?)\s*(k)?\s*(?:₹|rs\b|rupees|inr|bucks)/,
    /\b(?:under|below|within|less than|max(?:imum)?|budget(?: of| is)?|up ?to|not more than|cap(?:ped)? at|at most)\s*(?:₹|rs\.?)?\s*([\d,]+(?:\.\d+)?)\s*(k)?\b(?!\s*(?:minutes|mins?|min|hours?|hrs?|people|persons))/,
  ];

  for (const pattern of money) {
    const match = text.match(pattern);
    if (!match) continue;
    const amount = parseAmount(match[1], match[2]);
    if (!amount || amount < 20) continue;

    // "₹200 each" / "per person" / "per head"
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 20);
    if (/^\s*(each|per (person|head|plate)|a head|apiece)\b/.test(after) && partySize) {
      return amount * partySize;
    }
    return amount;
  }
  return null;
};

/**
 * Deterministic parse of a request. `explicit` lists the fields the text states
 * unambiguously; those are trusted over the LLM's reading in reconcileSpec.
 */
const parseRequest = (input) => {
  let text = ` ${String(input || "").toLowerCase().replace(/\s+/g, " ")} `;
  const explicit = new Set();

  const partySize = findPartySize(text);
  if (partySize) explicit.add("partySize");

  const budgetTotal = findBudget(text, partySize || 1);
  if (budgetTotal) explicit.add("budgetTotal");

  const maxDeliveryMinutes = findMinutes(text);
  if (maxDeliveryMinutes) explicit.add("maxDeliveryMinutes");

  const nonVeg = /\bnon[- ]?veg(etarian)?\b/.test(text);
  const veg = !nonVeg && /\b(veg|vegetarian|vegan|pure veg|meatless|no meat|plant[- ]based)\b/.test(text);
  if (veg) explicit.add("diet");

  let spice = null;
  if (/\b(not (too |very |that )?spicy|no spice|less spicy|mild|not hot|non[- ]spicy|bland)\b/.test(text)) {
    spice = "no_hot";
  } else if (/\b(spicy|fiery|hot and|extra hot|spice lover|tikhaa?|teekha)\b/.test(text)) {
    spice = "hot";
  }

  const cuisines = CUISINE_WORDS.filter(([pattern]) => pattern.test(text)).map(([, cuisine]) => cuisine);

  const exclude = [];
  const excludePattern = /\b(?:no|without|avoid|allergic to|skip|hold the|don't want|dont want|not)\s+([a-z]+(?: [a-z]+)?)/g;
  let match;
  while ((match = excludePattern.exec(text))) {
    const words = match[1].split(" ");
    for (const word of [match[1], words[0]]) {
      const singular = word.replace(/s$/, "");
      const found = EXCLUDABLE.find((entry) => entry === singular || entry === word);
      if (found) {
        exclude.push(found);
        break;
      }
    }
  }

  if (/\bsomething sweet\b|\bsweets?\b/.test(text) && !/\bdessert/.test(text)) {
    text += " dessert ";
  }

  const include = DISH_WORDS.filter((dish) => {
    const pattern = new RegExp(`\\b${dish.replace(/ /g, "\\s")}s?\\b`);
    if (!pattern.test(text)) return false;
    // "no paneer" excludes rather than includes.
    return !exclude.some((word) => dish.includes(word));
  });

  return {
    spec: normalizeSpec({
      diet: veg ? "veg" : "any",
      cuisines,
      spice,
      partySize: partySize || 1,
      budgetTotal,
      maxDeliveryMinutes,
      include,
      exclude,
    }),
    explicit: [...explicit],
  };
};

/**
 * Validates the LLM's reading of a request against the deterministic parser.
 * Explicitly stated numbers and an explicit vegetarian request override the
 * LLM; everything else the LLM inferred is kept. Constraints are only ever
 * corrected towards what the text says, never loosened.
 */
const reconcileSpec = (llmSpecRaw, text) => {
  const llmSpec = normalizeSpec(llmSpecRaw);
  const { spec: parsed, explicit } = parseRequest(text);
  const spec = { ...llmSpec };
  const corrections = [];

  const correct = (field, value, reason) => {
    corrections.push({ field, from: spec[field], to: value, reason });
    spec[field] = value;
  };

  for (const field of ["budgetTotal", "partySize", "maxDeliveryMinutes"]) {
    if (explicit.includes(field) && parsed[field] !== llmSpec[field]) {
      correct(field, parsed[field], "stated explicitly in the request");
    }
  }

  if (explicit.includes("diet") && llmSpec.diet !== "veg") {
    correct("diet", "veg", "the request asks for vegetarian food");
  }

  const missingExcludes = parsed.exclude.filter((word) => !spec.exclude.includes(word));
  if (missingExcludes.length) {
    correct("exclude", [...spec.exclude, ...missingExcludes], "the request rules these out");
  }

  return { spec, corrections };
};

module.exports = {
  CUISINES,
  normalizeSpec,
  parseRequest,
  reconcileSpec,
};
