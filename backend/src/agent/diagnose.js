const { estimateOrderEta } = require("../services/analyticsService");
const { TAX_RATE, DELIVERY_FEE } = require("../services/pricingService");
const { matchesKeyword, isEligible, isHot, restaurantMatchesCuisine, cheapestCart } = require("./catalog");

// Explains why no cart can satisfy a spec, naming the constraint that rules
// everything out, and suggests the closest thing that can be ordered.
// "No open restaurant has dishes that match the request" helps nobody;
// "Veg Dum Biryani is only at Midnight Biryani, which is closed right now" does.

const rupees = (value) => `₹${Math.round(value)}`;
const total = (subtotal) => subtotal + Math.round(subtotal * TAX_RATE * 100) / 100 + DELIVERY_FEE;
const listNames = (items) => [...new Set(items.map((item) => item.name))].slice(0, 3).join(", ");

// Results carry specific: false only when no single constraint could be named.
const diagnose = (spec, catalog) => {
  const open = catalog.filter(({ restaurant }) => restaurant.isOpen);
  const all = (entries) => entries.flatMap(({ restaurant, items }) => items.map((item) => ({ item, restaurant })));

  // 1. A dish the customer named.
  for (const word of spec.include) {
    const everywhere = all(catalog).filter(({ item }) => matchesKeyword(item, word));
    if (!everywhere.length) {
      return { reason: `Nothing on Foodex matches "${word}".`, closestOption: null };
    }

    const allowed = everywhere.filter(({ item }) => isEligible(item, spec));
    const allowedOpen = allowed.filter(({ restaurant }) => restaurant.isOpen);
    const anyOpen = everywhere.filter(({ restaurant }) => restaurant.isOpen);

    if (!allowedOpen.length) {
      // Something matching is open but breaks a constraint (diet, spice, exclusions).
      const alternative = anyOpen[0]
        ? `${anyOpen[0].item.name} at ${anyOpen[0].restaurant.name} is available now`
        : null;

      if (allowed.length) {
        const closed = allowed[0];
        return {
          reason: `${listNames(allowed.map(({ item }) => item))} is only on the menu at ${closed.restaurant.name}, which is closed right now.`,
          closestOption: alternative ? `${alternative}${spec.diet === "veg" && !anyOpen[0].item.isVeg ? ", but it isn't vegetarian" : ""}.` : null,
        };
      }
      if (spec.diet === "veg" && everywhere.every(({ item }) => !item.isVeg)) {
        return {
          reason: `There's no vegetarian ${word} on Foodex: ${listNames(everywhere.map(({ item }) => item))} ${everywhere.length === 1 ? "isn't" : "aren't"} vegetarian.`,
          closestOption: alternative ? `${alternative} if non-vegetarian is fine.` : null,
        };
      }
      return {
        reason: `Every ${word} dish breaks another part of the request (${[
          spec.diet === "veg" ? "vegetarian" : null,
          spec.spice === "no_hot" ? "not spicy" : null,
          spec.exclude.length ? `no ${spec.exclude.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(", ")}).`,
        closestOption: alternative ? `${alternative}.` : null,
      };
    }
  }

  // 2. A cuisine.
  if (spec.cuisines.length && !open.some(({ restaurant }) => restaurantMatchesCuisine(restaurant, spec))) {
    return { reason: `No ${spec.cuisines.join(" or ")} restaurant is open right now.`, closestOption: null };
  }

  // 3. Something spicy at all.
  if (spec.spice === "hot" && !all(open).some(({ item, restaurant }) => isHot(item) && isEligible(item, spec) && restaurantMatchesCuisine(restaurant, spec))) {
    return { reason: "No open restaurant has a spicy dish that fits the rest of the request.", closestOption: null };
  }

  // 4. Time and money: what is the best that can be done?
  const options = open
    .filter(({ restaurant }) => restaurantMatchesCuisine(restaurant, spec))
    .map(({ restaurant, items }) => {
      const cart = cheapestCart(spec, items);
      if (!cart) return null;
      const itemCount = cart.items.reduce((sum, line) => sum + line.quantity, 0);
      return { restaurant, total: total(cart.subtotal), eta: estimateOrderEta({ restaurant, itemCount }).minutes };
    })
    .filter(Boolean);

  if (!options.length) {
    return { reason: "No open restaurant has dishes that fit every part of the request.", closestOption: null };
  }

  const fastest = [...options].sort((a, b) => a.eta - b.eta)[0];
  if (spec.maxDeliveryMinutes && fastest.eta > spec.maxDeliveryMinutes) {
    return {
      reason: `Nothing can arrive within ${spec.maxDeliveryMinutes} minutes; the fastest is about ${fastest.eta} minutes.`,
      closestOption: `${fastest.restaurant.name} can deliver in about ${fastest.eta} min for ${rupees(fastest.total)}.`,
    };
  }

  const inTime = options.filter((option) => !spec.maxDeliveryMinutes || option.eta <= spec.maxDeliveryMinutes);
  const cheapest = [...inTime].sort((a, b) => a.total - b.total)[0];
  if (spec.budgetTotal && cheapest.total > spec.budgetTotal) {
    return {
      reason: `The cheapest cart that fits is ${rupees(cheapest.total)} (tax and delivery included), above your ${rupees(spec.budgetTotal)} budget.`,
      closestOption: `${cheapest.restaurant.name} for ${rupees(cheapest.total)}, about ${cheapest.eta} min.`,
    };
  }

  // No single constraint explains it (for example, a combination of them does).
  return { reason: "No single restaurant can make a cart that fits every part of the request.", closestOption: null, specific: false };
};

module.exports = { diagnose };
