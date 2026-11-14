const mongoose = require("mongoose");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const pricingService = require("../services/pricingService");
const { estimateOrderEta } = require("../services/analyticsService");
const { matchesKeyword, isHot, countsAsServing, restaurantMatchesCuisine } = require("./catalog");

// Checks a proposed cart against an order spec. Deterministic and server-side:
// the agent proposes, this decides. The same function gates confirmation, so a
// cart is re-checked with fresh prices and availability before any order is made.

const formatRupees = (value) => `₹${Number(value).toFixed(2).replace(/\.00$/, "")}`;

const check = (id, label, passed, detail) => ({ id, label, passed: Boolean(passed), detail });

/**
 * @returns {Promise<{ passed, checks, quote, eta, restaurant, lines }>}
 * `checks` lists every rule that applies to the spec, passed or not, so the UI
 * can show the whole checklist and the agent gets every failure at once.
 */
const validateCart = async ({ spec, restaurantId, items }) => {
  const checks = [];
  const fail = (id, label, detail) => ({ passed: false, checks: [...checks, check(id, label, false, detail)] });

  if (!mongoose.isValidObjectId(restaurantId)) {
    return fail("restaurant", "Restaurant exists", `"${restaurantId}" is not a restaurant id from search_menus`);
  }
  const restaurant = await Restaurant.findById(restaurantId).lean();
  if (!restaurant) {
    return fail("restaurant", "Restaurant exists", "No restaurant with that id");
  }
  checks.push(check("restaurant_open", "Restaurant is open", restaurant.isOpen, restaurant.isOpen ? restaurant.name : `${restaurant.name} is closed`));
  if (!restaurant.isOpen) {
    return { passed: false, checks, restaurant };
  }

  const requested = (Array.isArray(items) ? items : []).filter((line) => line && line.menuItemId);
  if (!requested.length) {
    return fail("items", "Cart has dishes", "The cart is empty");
  }

  let quote;
  try {
    quote = await pricingService.quote({ restaurantId, items: requested.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity })) });
  } catch (error) {
    return fail("items", "Dishes are on this restaurant's menu and available", error.message);
  }
  checks.push(check("items", "Dishes are on the menu and available", true, `${quote.lines.length} dishes`));

  const menuItems = await MenuItem.find({ _id: { $in: quote.lines.map((line) => line.menuItem) } }).lean();
  const byId = new Map(menuItems.map((item) => [String(item._id), item]));
  const lines = quote.lines.map((line) => ({ ...line, item: byId.get(String(line.menuItem)) }));

  if (spec.cuisines.length) {
    const ok = restaurantMatchesCuisine(restaurant, spec);
    checks.push(check("cuisine", `Cuisine: ${spec.cuisines.join(" or ")}`, ok, ok ? (restaurant.cuisine || []).join(", ") : `${restaurant.name} serves ${(restaurant.cuisine || []).join(", ")}`));
  }

  if (spec.diet === "veg") {
    const nonVeg = lines.filter((line) => !line.item?.isVeg).map((line) => line.name);
    checks.push(check("diet", "All dishes vegetarian", !nonVeg.length, nonVeg.length ? `Not vegetarian: ${nonVeg.join(", ")}` : "Every dish is veg"));
  }

  if (spec.spice === "hot") {
    const hot = lines.filter((line) => isHot(line.item)).map((line) => line.name);
    checks.push(check("spice", "Something spicy", hot.length > 0, hot.length ? `Spicy: ${hot.join(", ")}` : "No dish is marked hot"));
  } else if (spec.spice === "no_hot") {
    const hot = lines.filter((line) => isHot(line.item)).map((line) => line.name);
    checks.push(check("spice", "Nothing too spicy", !hot.length, hot.length ? `Hot: ${hot.join(", ")}` : "No hot dishes"));
  }

  for (const word of spec.include) {
    const found = lines.find((line) => matchesKeyword(line.item, word));
    checks.push(check(`include_${word}`, `Includes ${word}`, Boolean(found), found ? found.name : `Nothing matching "${word}"`));
  }

  for (const word of spec.exclude) {
    const found = lines.filter((line) => matchesKeyword(line.item, word)).map((line) => line.name);
    checks.push(check(`exclude_${word}`, `No ${word}`, !found.length, found.length ? `Contains ${word}: ${found.join(", ")}` : `No ${word}`));
  }

  const servings = lines.reduce((sum, line) => sum + (countsAsServing(line.item, spec) ? line.quantity : 0), 0);
  const maxServings = Math.max(spec.partySize * 3, spec.partySize + 4);
  checks.push(
    check(
      "party_size",
      `Enough for ${spec.partySize} ${spec.partySize === 1 ? "person" : "people"}`,
      servings >= spec.partySize && servings <= maxServings,
      servings < spec.partySize
        ? `${servings} dishes for ${spec.partySize} people (drinks don't count)`
        : servings > maxServings
          ? `${servings} dishes is far more than ${spec.partySize} people need`
          : `${servings} dishes`
    )
  );

  if (spec.budgetTotal) {
    const ok = quote.totalAmount <= spec.budgetTotal;
    checks.push(
      check(
        "budget",
        `Within ${formatRupees(spec.budgetTotal)}`,
        ok,
        ok
          ? `${formatRupees(quote.totalAmount)} incl. tax and delivery`
          : `${formatRupees(quote.totalAmount)} is ${formatRupees(quote.totalAmount - spec.budgetTotal)} over budget`
      )
    );
  }

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const eta = estimateOrderEta({ restaurant, itemCount });
  if (spec.maxDeliveryMinutes) {
    const ok = eta.minutes <= spec.maxDeliveryMinutes;
    checks.push(
      check(
        "delivery_time",
        `Delivered within ${spec.maxDeliveryMinutes} min`,
        ok,
        ok ? `About ${eta.minutes} min` : `About ${eta.minutes} min, ${eta.minutes - spec.maxDeliveryMinutes} min too slow`
      )
    );
  }

  return {
    passed: checks.every((entry) => entry.passed),
    checks,
    quote: pricingService.toQuoteResponse(quote),
    eta,
    restaurant: { id: String(restaurant._id), name: restaurant.name, cuisine: restaurant.cuisine },
    lines: lines.map((line) => ({
      menuItemId: String(line.menuItem),
      name: line.name,
      quantity: line.quantity,
      price: line.price,
      isVeg: Boolean(line.item?.isVeg),
      spiceLevel: line.item?.spiceLevel,
    })),
  };
};

module.exports = { validateCart };
