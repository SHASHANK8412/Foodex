// Evaluation set for the ordering agent: 50 requests with the constraints a
// careful human would read from each (the ground truth). A cart is scored
// against this ground truth, never against the agent's own reading, so an agent
// that misreads a request and builds a cart for its misreading still fails.
//
// `feasible` is what the author expects; runEval.js recomputes it from the
// catalogue with an exhaustive oracle and reports any disagreement.
//
// Fields follow agent/orderSpec.js; omitted fields are unconstrained.

module.exports = [
  { id: 1, text: "Something spicy and veg for 3 people, under ₹600, delivered in 30 minutes", expected: { diet: "veg", spice: "hot", partySize: 3, budgetTotal: 600, maxDeliveryMinutes: 30 }, feasible: true },
  { id: 2, text: "pizza for two under ₹900", expected: { include: ["pizza"], partySize: 2, budgetTotal: 900 }, feasible: true },
  { id: 3, text: "biryani for me", expected: { include: ["biryani"], partySize: 1 }, feasible: true },
  { id: 4, text: "Italian dinner for me and my wife, she's vegetarian, around ₹700", expected: { cuisines: ["Italian"], diet: "veg", partySize: 2, budgetTotal: 700 }, feasible: true },
  { id: 5, text: "Quick South Indian breakfast for 4, ₹150 each", expected: { cuisines: ["South Indian"], partySize: 4, budgetTotal: 600 }, feasible: true },
  { id: 6, text: "Burgers for 2, no chicken, not too spicy", expected: { cuisines: ["Burgers"], partySize: 2, exclude: ["chicken"], spice: "no_hot" }, feasible: true },
  { id: 7, text: "Chinese for 3 people, budget 700", expected: { cuisines: ["Chinese"], partySize: 3, budgetTotal: 700 }, feasible: true },
  { id: 8, text: "veg food for 3 delivered in 20 minutes", expected: { diet: "veg", partySize: 3, maxDeliveryMinutes: 20 }, feasible: false },
  { id: 9, text: "dinner for 4 under ₹100", expected: { partySize: 4, budgetTotal: 100 }, feasible: false },
  { id: 10, text: "Just vegetarian food for one, anything under 200 rupees", expected: { diet: "veg", partySize: 1, budgetTotal: 200 }, feasible: true },
  { id: 11, text: "Feed six of us for under ₹1,000, whatever's fastest", expected: { partySize: 6, budgetTotal: 1000 }, feasible: true },
  { id: 12, text: "Something sweet for two", expected: { include: ["dessert"], partySize: 2 }, feasible: true },
  { id: 13, text: "A pizza and garlic bread for 2, under 800", expected: { include: ["pizza", "garlic bread"], partySize: 2, budgetTotal: 800 }, feasible: true },
  { id: 14, text: "Hot and spicy chicken for 2, under ₹700, within 45 min", expected: { spice: "hot", include: ["chicken"], partySize: 2, budgetTotal: 700, maxDeliveryMinutes: 45 }, feasible: true },
  { id: 15, text: "No onion, no garlic veg meal for one under ₹300", expected: { diet: "veg", exclude: ["onion", "garlic"], partySize: 1, budgetTotal: 300 }, feasible: true },
  { id: 16, text: "I want dosa and filter coffee for 2 people", expected: { include: ["dosa", "coffee"], partySize: 2 }, feasible: true },
  { id: 17, text: "Lunch for the team of 8, all veg, under ₹2000, within an hour", expected: { diet: "veg", partySize: 8, budgetTotal: 2000, maxDeliveryMinutes: 60 }, feasible: true },
  { id: 18, text: "Something healthy for me, no tofu", expected: { cuisines: ["Healthy"], exclude: ["tofu"], partySize: 1 }, feasible: true },
  { id: 19, text: "Pasta for 3 under ₹400", expected: { include: ["pasta"], partySize: 3, budgetTotal: 400 }, feasible: false },
  { id: 20, text: "Chilli paneer and noodles for two, veg, under ₹600", expected: { include: ["paneer", "noodles"], diet: "veg", partySize: 2, budgetTotal: 600 }, feasible: true },
  { id: 21, text: "Mild food for my 2 kids and me, under 500", expected: { spice: "no_hot", partySize: 3, budgetTotal: 500 }, feasible: true },
  { id: 22, text: "Get me a burger in 25 minutes", expected: { include: ["burger"], partySize: 1, maxDeliveryMinutes: 25 }, feasible: false },
  { id: 23, text: "Biryani for 4 within 40 minutes", expected: { include: ["biryani"], partySize: 4, maxDeliveryMinutes: 40 }, feasible: false },
  { id: 24, text: "Veg pizza without mushrooms for 2", expected: { diet: "veg", include: ["pizza"], exclude: ["mushroom"], partySize: 2 }, feasible: true },
  { id: 25, text: "Pepperoni pizza, but I'm vegetarian", expected: { diet: "veg", include: ["pepperoni"], partySize: 1 }, feasible: false },
  { id: 26, text: "Desserts for 5 people under ₹800", expected: { include: ["dessert"], partySize: 5, budgetTotal: 800 }, feasible: true },
  { id: 27, text: "Chai and samosa for 3", expected: { include: ["chai", "samosa"], partySize: 3 }, feasible: true },
  { id: 28, text: "I have ₹250, feed me something filling", expected: { partySize: 1, budgetTotal: 250 }, feasible: true },
  { id: 29, text: "Romantic Italian dinner for two, with dessert, under ₹1,200", expected: { cuisines: ["Italian"], include: ["dessert"], partySize: 2, budgetTotal: 1200 }, feasible: true },
  { id: 30, text: "Something spicy for one, delivered within 30 minutes", expected: { spice: "hot", partySize: 1, maxDeliveryMinutes: 30 }, feasible: true },
  { id: 31, text: "Non-veg Chinese for 2, under 650", expected: { cuisines: ["Chinese"], partySize: 2, budgetTotal: 650 }, feasible: true },
  { id: 32, text: "Salad and a cold-pressed juice, just for me", expected: { include: ["salad", "juice"], partySize: 1 }, feasible: true },
  { id: 33, text: "Paneer dish for 3 people under ₹800", expected: { include: ["paneer"], partySize: 3, budgetTotal: 800 }, feasible: true },
  { id: 34, text: "Food for 10 people in 30 minutes under ₹700", expected: { partySize: 10, budgetTotal: 700, maxDeliveryMinutes: 30 }, feasible: false },
  { id: 35, text: "Two vada pavs and a chai, quick", expected: { include: ["vada pav", "chai"], partySize: 1 }, feasible: true },
  { id: 36, text: "Healthy veg bowl for 2 under ₹500", expected: { cuisines: ["Healthy"], diet: "veg", include: ["bowl"], partySize: 2, budgetTotal: 500 }, feasible: false },
  { id: 37, text: "Craving noodles. Me and 2 friends. Max 45 minutes.", expected: { include: ["noodles"], partySize: 3, maxDeliveryMinutes: 45 }, feasible: true },
  { id: 38, text: "Breakfast for the family of 4, nothing fried, south indian", expected: { cuisines: ["South Indian"], exclude: ["fried"], partySize: 4 }, feasible: true },
  { id: 39, text: "Gulab jamun and rasmalai for 2", expected: { include: ["gulab jamun", "rasmalai"], partySize: 2 }, feasible: false },
  { id: 40, text: "Three pizzas for a party, under ₹1000", expected: { include: ["pizza"], partySize: 3, budgetTotal: 1000 }, feasible: true },
  { id: 41, text: "Something light for my wife and me, she can't handle spice", expected: { partySize: 2, spice: "no_hot" }, feasible: true },
  { id: 42, text: "Order 2 masala dosas and 2 filter coffees", expected: { include: ["dosa", "coffee"], partySize: 2 }, feasible: true },
  { id: 43, text: "Veg meal for 5 under ₹500 in 40 minutes", expected: { diet: "veg", partySize: 5, budgetTotal: 500, maxDeliveryMinutes: 40 }, feasible: true },
  { id: 44, text: "Chicken biryani for 2 in half an hour", expected: { include: ["chicken biryani"], partySize: 2, maxDeliveryMinutes: 30 }, feasible: false },
  { id: 45, text: "Pure veg Chinese for 4 under ₹900 within 50 mins", expected: { cuisines: ["Chinese"], diet: "veg", partySize: 4, budgetTotal: 900, maxDeliveryMinutes: 50 }, feasible: true },
  { id: 46, text: "A cheesecake and a waffle, delivered in 30 min", expected: { include: ["cheesecake", "waffle"], partySize: 1, maxDeliveryMinutes: 30 }, feasible: true },
  { id: 47, text: "Feed 3 hungry people for ₹300 total", expected: { partySize: 3, budgetTotal: 300 }, feasible: true },
  { id: 48, text: "I'd like fries and a shake, under 200", expected: { include: ["fries", "shake"], partySize: 1, budgetTotal: 200 }, feasible: false },
  { id: 49, text: "Garlic bread for 2, but no garlic please", expected: { include: ["garlic bread"], exclude: ["garlic"], partySize: 2 }, feasible: false },
  { id: 50, text: "Dinner for 2 with a spicy dish, no paneer, veg, under ₹600, by 40 minutes", expected: { diet: "veg", spice: "hot", exclude: ["paneer"], partySize: 2, budgetTotal: 600, maxDeliveryMinutes: 40 }, feasible: true },
];
