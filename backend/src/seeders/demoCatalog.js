const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");

// The demo catalogue: the three original restaurants (seeded in demoData.js)
// get fuller menus, and six more restaurants are added. It is deliberately
// varied (diets, spice levels, prices, kitchen wait times, one closed
// restaurant) so that ordering, and the AI ordering agent, involve real
// trade-offs. Inserting is idempotent: existing restaurants and dishes are
// matched by name and left as they are.

const item = (name, price, isVeg, spiceLevel, category, tags, description) => ({
  name,
  price,
  isVeg,
  spiceLevel,
  category,
  tags,
  description,
});

const BENGALURU = { city: "Bengaluru", state: "Karnataka" };

const RESTAURANTS = [
  {
    name: "Urban Spice Kitchen",
    items: [
      item("Dal Makhani", 219, true, "mild", "Main Course", ["veg", "indian", "lentils", "creamy"], "Black lentils slow-cooked overnight with butter."),
      item("Veg Kolhapuri", 239, true, "hot", "Main Course", ["veg", "indian", "spicy"], "Mixed vegetables in a fiery Kolhapuri masala."),
      item("Chana Masala", 199, true, "medium", "Main Course", ["veg", "indian", "chickpeas"], "Chickpeas in a tangy onion-tomato gravy."),
      item("Butter Naan", 49, true, "mild", "Breads", ["veg", "bread"], "Tandoor-baked flatbread brushed with butter."),
      item("Jeera Rice", 149, true, "mild", "Rice", ["veg", "rice"], "Basmati rice tempered with cumin."),
      item("Gulab Jamun", 99, true, "mild", "Desserts", ["veg", "dessert", "sweet"], "Two milk dumplings in rose syrup."),
    ],
  },
  {
    name: "Dragon Bowl",
    items: [
      item("Chilli Paneer", 249, true, "hot", "Starters", ["veg", "chinese", "paneer", "spicy"], "Paneer tossed with peppers in a hot chilli sauce."),
      item("Veg Manchurian", 219, true, "medium", "Main Course", ["veg", "chinese"], "Vegetable dumplings in Manchurian gravy."),
      item("Schezwan Veg Fried Rice", 209, true, "hot", "Rice", ["veg", "chinese", "rice", "spicy"], "Wok-fried rice in fiery Schezwan sauce."),
      item("Veg Spring Rolls", 169, true, "mild", "Starters", ["veg", "chinese"], "Crisp rolls stuffed with cabbage and carrot."),
      item("Hot and Sour Soup", 139, true, "hot", "Soups", ["veg", "chinese", "soup", "spicy"], "Peppery soup with tofu and mushrooms."),
    ],
  },
  {
    name: "Pasta Street",
    items: [
      item("Garlic Bread", 129, true, "mild", "Sides", ["veg", "italian", "bread"], "Toasted bread with garlic butter and herbs."),
      item("Farmhouse Pizza", 349, true, "mild", "Pizza", ["veg", "italian", "pizza", "mushroom"], "Onion, capsicum, mushroom and sweetcorn."),
      item("Pepperoni Pizza", 379, false, "medium", "Pizza", ["italian", "pizza", "pork"], "Pepperoni and mozzarella on a thin crust."),
      item("Mushroom Risotto", 299, true, "mild", "Mains", ["veg", "italian", "mushroom", "creamy"], "Arborio rice with wild mushrooms and parmesan."),
      item("Tiramisu", 189, true, "mild", "Desserts", ["veg", "italian", "dessert", "coffee"], "Coffee-soaked layers with mascarpone."),
    ],
  },
  {
    name: "Dosa Junction",
    description: "South Indian tiffin: dosas, idlis and filter coffee.",
    cuisine: ["South Indian", "Indian"],
    imageUrl: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1200&q=80",
    location: { lat: 12.9352, lng: 77.6245 },
    line1: "45 Koramangala 5th Block",
    postalCode: "560095",
    avgPrepMinutes: 14,
    estimatedWaitMinutes: 15,
    rating: 4.5,
    items: [
      item("Masala Dosa", 129, true, "medium", "Dosa", ["veg", "south indian", "dosa", "potato"], "Crisp dosa with spiced potato filling."),
      item("Mysore Masala Dosa", 149, true, "hot", "Dosa", ["veg", "south indian", "dosa", "spicy"], "Dosa lined with fiery red chutney."),
      item("Rava Uttapam", 139, true, "mild", "Dosa", ["veg", "south indian"], "Semolina pancake topped with onion and tomato."),
      item("Ghee Podi Idli", 119, true, "medium", "Idli", ["veg", "south indian", "idli"], "Mini idlis tossed in ghee and gunpowder spice."),
      item("Medu Vada", 89, true, "mild", "Snacks", ["veg", "south indian", "fried"], "Two crisp lentil doughnuts with sambar."),
      item("Bisi Bele Bath", 149, true, "medium", "Rice", ["veg", "south indian", "rice", "lentils"], "Rice and lentils cooked with tamarind and spice."),
      item("Curd Rice", 109, true, "mild", "Rice", ["veg", "south indian", "rice", "dairy"], "Rice with yoghurt, tempered with mustard seeds."),
      item("Filter Coffee", 49, true, "mild", "Beverages", ["veg", "beverage", "coffee"], "South Indian filter coffee with chicory."),
    ],
  },
  {
    name: "Chaat Street",
    description: "Mumbai and Delhi street food, made to order.",
    cuisine: ["Street Food", "Indian"],
    imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80",
    location: { lat: 12.9784, lng: 77.6408 },
    line1: "18 100 Feet Road, Indiranagar",
    postalCode: "560038",
    avgPrepMinutes: 12,
    estimatedWaitMinutes: 15,
    rating: 4.3,
    items: [
      item("Pani Puri", 79, true, "hot", "Chaat", ["veg", "street food", "chaat", "spicy"], "Eight puris with spicy mint water."),
      item("Pav Bhaji", 149, true, "medium", "Mains", ["veg", "street food", "bread"], "Mashed vegetable curry with buttered pav."),
      item("Vada Pav", 59, true, "hot", "Snacks", ["veg", "street food", "potato", "spicy"], "Potato fritter in a bun with garlic chutney."),
      item("Dahi Puri", 99, true, "mild", "Chaat", ["veg", "street food", "chaat", "dairy"], "Puris filled with yoghurt and sweet chutney."),
      item("Samosa (2 pcs)", 49, true, "medium", "Snacks", ["veg", "street food", "potato", "fried"], "Pastry filled with spiced potato and peas."),
      item("Chole Bhature", 169, true, "medium", "Mains", ["veg", "street food", "chickpeas", "fried"], "Spiced chickpeas with two fried breads."),
      item("Masala Chai", 39, true, "mild", "Beverages", ["veg", "beverage", "tea"], "Tea brewed with ginger and cardamom."),
    ],
  },
  {
    name: "Burger Barn",
    description: "Smash burgers, wings and loaded fries.",
    cuisine: ["Burgers", "American", "Fast Food"],
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80",
    location: { lat: 12.9698, lng: 77.75 },
    line1: "7 ITPL Main Road, Whitefield",
    postalCode: "560066",
    avgPrepMinutes: 18,
    estimatedWaitMinutes: 18,
    rating: 4.1,
    items: [
      item("Classic Chicken Burger", 199, false, "mild", "Burgers", ["burger", "chicken"], "Grilled chicken patty with lettuce and mayo."),
      item("Double Patty Burger", 299, false, "medium", "Burgers", ["burger", "chicken", "cheese"], "Two chicken patties, cheddar and pickles."),
      item("Veg Cheese Burger", 169, true, "mild", "Burgers", ["veg", "burger", "cheese"], "Crumbed vegetable patty with cheese."),
      item("Peri Peri Paneer Burger", 219, true, "hot", "Burgers", ["veg", "burger", "paneer", "spicy"], "Grilled paneer with peri peri sauce."),
      item("Crispy Chicken Wings", 249, false, "hot", "Sides", ["chicken", "spicy", "fried"], "Six wings in a hot glaze."),
      item("French Fries", 99, true, "mild", "Sides", ["veg", "fried", "potato"], "Salted fries."),
      item("Peri Peri Fries", 129, true, "hot", "Sides", ["veg", "fried", "potato", "spicy"], "Fries dusted with peri peri seasoning."),
      item("Chocolate Shake", 149, true, "mild", "Beverages", ["veg", "beverage", "dessert", "dairy"], "Thick chocolate milkshake."),
    ],
  },
  {
    name: "Green Bowl",
    description: "Salads, grain bowls and wraps.",
    cuisine: ["Healthy", "Salads"],
    imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
    location: { lat: 12.9121, lng: 77.6446 },
    line1: "22 HSR Layout Sector 2",
    postalCode: "560102",
    avgPrepMinutes: 20,
    estimatedWaitMinutes: 20,
    rating: 4.4,
    items: [
      item("Quinoa Buddha Bowl", 279, true, "mild", "Bowls", ["veg", "vegan", "healthy", "quinoa"], "Quinoa, roast vegetables, chickpeas and tahini."),
      item("Spicy Tofu Bowl", 289, true, "hot", "Bowls", ["veg", "vegan", "healthy", "tofu", "spicy"], "Chilli-glazed tofu on brown rice."),
      item("Grilled Chicken Salad", 299, false, "mild", "Salads", ["healthy", "chicken", "salad"], "Grilled chicken over greens with vinaigrette."),
      item("Greek Salad", 239, true, "mild", "Salads", ["veg", "healthy", "salad", "dairy"], "Cucumber, olives, tomato and feta."),
      item("Hummus Falafel Wrap", 229, true, "medium", "Wraps", ["veg", "vegan", "healthy", "chickpeas"], "Falafel, hummus and pickles in a wrap."),
      item("Cold-Pressed Juice", 129, true, "mild", "Beverages", ["veg", "vegan", "beverage", "healthy"], "Orange, carrot and ginger."),
    ],
  },
  {
    name: "Sweet Tooth",
    description: "Cakes, waffles and Indian sweets.",
    cuisine: ["Desserts", "Bakery"],
    imageUrl: "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=1200&q=80",
    location: { lat: 12.9719, lng: 77.6412 },
    line1: "3 CMH Road, Indiranagar",
    postalCode: "560038",
    avgPrepMinutes: 10,
    estimatedWaitMinutes: 15,
    rating: 4.6,
    items: [
      item("Chocolate Brownie", 129, true, "mild", "Cakes", ["veg", "dessert", "chocolate"], "Warm fudgy brownie."),
      item("Red Velvet Pastry", 149, true, "mild", "Cakes", ["veg", "dessert"], "Red velvet sponge with cream cheese frosting."),
      item("Belgian Waffle", 189, true, "mild", "Waffles", ["veg", "dessert", "chocolate"], "Waffle with chocolate sauce."),
      item("Mango Cheesecake", 219, true, "mild", "Cakes", ["veg", "dessert", "dairy", "mango"], "Baked cheesecake with mango glaze."),
      item("Rasmalai", 119, true, "mild", "Indian Sweets", ["veg", "dessert", "dairy", "sweet"], "Two cottage cheese discs in saffron milk."),
      item("Hot Chocolate", 139, true, "mild", "Beverages", ["veg", "beverage", "chocolate", "dairy"], "Rich hot chocolate."),
    ],
  },
  {
    name: "Midnight Biryani",
    description: "Hyderabadi dum biryani. Opens late evening.",
    cuisine: ["Biryani", "Hyderabadi"],
    imageUrl: "https://images.unsplash.com/photo-1563379091339-03246963d0ef?auto=format&fit=crop&w=1200&q=80",
    location: { lat: 12.9591, lng: 77.6974 },
    line1: "9 Marathahalli Bridge",
    postalCode: "560037",
    avgPrepMinutes: 25,
    estimatedWaitMinutes: 25,
    rating: 4.2,
    isOpen: false,
    items: [
      item("Hyderabadi Chicken Biryani", 319, false, "hot", "Biryani", ["biryani", "chicken", "spicy", "rice"], "Dum-cooked chicken biryani."),
      item("Veg Dum Biryani", 259, true, "hot", "Biryani", ["veg", "biryani", "spicy", "rice"], "Vegetables and basmati, sealed and slow-cooked."),
      item("Mirchi Ka Salan", 89, true, "hot", "Sides", ["veg", "spicy"], "Green chillies in a peanut and sesame gravy."),
    ],
  },
];

const ensureDemoCatalog = async ({ adminId }) => {
  let restaurantsAdded = 0;
  let itemsAdded = 0;

  for (const entry of RESTAURANTS) {
    let restaurant = await Restaurant.findOne({ name: entry.name });

    if (!restaurant) {
      if (!entry.cuisine) {
        // One of the original three, which demoData.js creates; nothing to extend yet.
        continue;
      }
      restaurant = await Restaurant.create({
        name: entry.name,
        description: entry.description,
        cuisine: entry.cuisine,
        imageUrl: entry.imageUrl,
        address: { line1: entry.line1, postalCode: entry.postalCode, ...BENGALURU, location: entry.location },
        isOpen: entry.isOpen !== false,
        avgPrepMinutes: entry.avgPrepMinutes,
        estimatedWaitMinutes: entry.estimatedWaitMinutes,
        demandLevel: "low",
        rating: entry.rating,
        createdBy: adminId,
      });
      restaurantsAdded += 1;
    }

    for (const [index, menuItem] of entry.items.entries()) {
      const result = await MenuItem.updateOne(
        { restaurant: restaurant._id, name: menuItem.name },
        { $setOnInsert: { ...menuItem, restaurant: restaurant._id, isAvailable: true, sortOrder: 10 + index } },
        { upsert: true }
      );
      itemsAdded += result.upsertedCount || 0;
    }
  }

  return { restaurantsAdded, itemsAdded };
};

module.exports = { ensureDemoCatalog, DEMO_CATALOG: RESTAURANTS };
