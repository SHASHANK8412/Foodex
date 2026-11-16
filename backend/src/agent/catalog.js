const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const { estimateOrderEta } = require("../services/analyticsService");

// Read-only catalogue access shared by the agent's tools, the validator, the
// rule-based agent and the evaluation oracle.

const NON_SERVING_CATEGORIES = new Set(["beverages"]);
const DRINK_WORDS = ["coffee", "chai", "tea", "shake", "juice", "hot chocolate"];

const normalizeWord = (word) => String(word || "").toLowerCase().trim().replace(/s$/, "");

// Name, category, tags and description, lower-cased, for keyword matching.
const itemText = (item) =>
  [item.name, item.category, ...(item.tags || []), item.description].filter(Boolean).join(" ").toLowerCase();

const matchesKeyword = (item, keyword) => {
  const word = normalizeWord(keyword);
  if (!word) return false;
  const text = itemText(item);
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s")}`).test(text);
};

const isHot = (item) => item.spiceLevel === "hot";

// Whether a dish counts as a serving for party size. Drinks do not, unless the
// request is only about drinks.
const countsAsServing = (item, spec) => {
  const isDrink = NON_SERVING_CATEGORIES.has(String(item.category || "").toLowerCase());
  if (!isDrink) return true;
  return spec.include.length > 0 && spec.include.every((word) => DRINK_WORDS.some((drink) => drink.includes(normalizeWord(word))));
};

const restaurantMatchesCuisine = (restaurant, spec) => {
  if (!spec.cuisines.length) return true;
  const cuisines = (restaurant.cuisine || []).map((value) => value.toLowerCase());
  return spec.cuisines.some((cuisine) => cuisines.includes(cuisine.toLowerCase()));
};

// Dishes the spec allows at all (diet, exclusions, "not spicy").
const isEligible = (item, spec) =>
  item.isAvailable !== false &&
  (spec.diet !== "veg" || item.isVeg === true) &&
  (spec.spice !== "no_hot" || !isHot(item)) &&
  !spec.exclude.some((word) => matchesKeyword(item, word));

const toPublicItem = (item) => ({
  menuItemId: String(item._id),
  name: item.name,
  price: item.price,
  isVeg: Boolean(item.isVeg),
  spiceLevel: item.spiceLevel || "medium",
  category: item.category,
  tags: item.tags || [],
});

const loadCatalog = async () => {
  const restaurants = await Restaurant.find({}).lean();
  const items = await MenuItem.find({ restaurant: { $in: restaurants.map((r) => r._id) }, isAvailable: true }).lean();
  const byRestaurant = new Map();
  items.forEach((item) => {
    const key = String(item.restaurant);
    byRestaurant.set(key, [...(byRestaurant.get(key) || []), item]);
  });
  return restaurants.map((restaurant) => ({ restaurant, items: byRestaurant.get(String(restaurant._id)) || [] }));
};

/**
 * The agent's search tool: open restaurants (optionally by cuisine) with their
 * delivery estimate and the dishes that pass the given filters.
 */
const searchMenus = async ({ cuisines = [], vegOnly = false, spicy = null, maxItemPrice = null, keywords = [] } = {}) => {
  const filterSpec = {
    diet: vegOnly ? "veg" : "any",
    spice: spicy === false ? "no_hot" : null,
    exclude: [],
    include: [],
    cuisines: (Array.isArray(cuisines) ? cuisines : [cuisines]).filter(Boolean),
  };
  const words = (Array.isArray(keywords) ? keywords : [keywords]).filter(Boolean);
  const catalog = await loadCatalog();

  return catalog
    .filter(({ restaurant }) => restaurant.isOpen && restaurantMatchesCuisine(restaurant, filterSpec))
    .map(({ restaurant, items }) => {
      // Every eligible dish, cheapest first; keyword and spice matches are
      // marked rather than filtered, so the model still sees the whole menu.
      const dishes = items
        .filter((item) => isEligible(item, filterSpec))
        .filter((item) => !maxItemPrice || item.price <= maxItemPrice)
        .sort((a, b) => a.price - b.price)
        .slice(0, 15)
        .map((item) => ({
          ...toPublicItem(item),
          ...(words.length ? { matchesKeywords: words.some((word) => matchesKeyword(item, word)) } : {}),
          ...(spicy === true ? { isHot: isHot(item) } : {}),
        }));

      return {
        restaurantId: String(restaurant._id),
        name: restaurant.name,
        cuisine: restaurant.cuisine,
        rating: restaurant.rating,
        deliveryMinutes: estimateOrderEta({ restaurant, itemCount: 2 }).minutes,
        dishes,
      };
    })
    .filter((entry) => entry.dishes.length)
    .sort((a, b) => a.deliveryMinutes - b.deliveryMinutes);
};

/**
 * The cheapest cart at one restaurant that meets every hard constraint of the
 * spec except budget and delivery time (the caller checks those against the
 * price and estimate). Used by the rule-based agent and the evaluation oracle.
 *
 * `preferMeals` fills the remaining servings from main-course-like categories
 * when possible, which is what a person would order; without it the fill is
 * simply the cheapest eligible dish.
 */
const MEAL_EXCLUDED = new Set(["beverages", "breads", "sides", "desserts", "soups"]);

const cheapestCart = (spec, items, { preferMeals = false } = {}) => {
  const eligible = items.filter((item) => isEligible(item, spec));
  if (!eligible.length) return null;

  const requirements = [...spec.include.map((word) => (item) => matchesKeyword(item, word))];
  if (spec.spice === "hot") requirements.push(isHot);

  // Smallest-cost set of dishes that covers every requirement (small menus, so brute force).
  let best = null;
  const search = (start, chosen, cost) => {
    if (best && cost >= best.cost) return;
    if (requirements.every((requirement) => chosen.some(requirement))) {
      best = { chosen: [...chosen], cost };
      return;
    }
    if (chosen.length >= requirements.length) return;
    for (let index = start; index < eligible.length; index += 1) {
      chosen.push(eligible[index]);
      search(index + 1, chosen, cost + eligible[index].price);
      chosen.pop();
    }
  };
  search(0, [], 0);
  if (!best) return null;

  const lines = new Map(best.chosen.map((item) => [String(item._id), { item, quantity: 1 }]));
  const servings = () => [...lines.values()].reduce((sum, line) => sum + (countsAsServing(line.item, spec) ? line.quantity : 0), 0);

  const servingItems = eligible.filter((item) => countsAsServing(item, spec));
  const meals = servingItems.filter((item) => !MEAL_EXCLUDED.has(String(item.category || "").toLowerCase()));
  const fillPool = preferMeals && meals.length ? meals : servingItems;
  const filler = [...fillPool].sort((a, b) => a.price - b.price)[0];
  if (servings() < spec.partySize && !filler) return null;

  while (servings() < spec.partySize) {
    const key = String(filler._id);
    const line = lines.get(key) || { item: filler, quantity: 0 };
    line.quantity += 1;
    lines.set(key, line);
  }

  const cart = [...lines.values()].map((line) => ({ menuItemId: String(line.item._id), name: line.item.name, quantity: line.quantity, price: line.item.price }));
  return { items: cart, subtotal: cart.reduce((sum, line) => sum + line.price * line.quantity, 0) };
};

module.exports = {
  normalizeWord,
  matchesKeyword,
  isHot,
  isEligible,
  countsAsServing,
  restaurantMatchesCuisine,
  loadCatalog,
  searchMenus,
  cheapestCart,
  toPublicItem,
};
