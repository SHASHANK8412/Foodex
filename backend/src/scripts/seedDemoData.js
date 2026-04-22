/* eslint-disable no-console */

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const ROLES = require("../constants/roles");

const ensureUser = async ({ email, name, password, role }) => {
  let user = await User.findOne({ email });
  if (user) return user;

  user = await User.create({
    email,
    name,
    password,
    role,
    authProvider: "local",
  });
  return user;
};

const upsertRestaurant = async (createdBy, data) => {
  const existing = await Restaurant.findOne({ name: data.name });
  if (existing) {
    existing.description = data.description;
    existing.cuisine = data.cuisine;
    existing.contactPhone = data.contactPhone;
    existing.imageUrl = data.imageUrl;
    existing.address = data.address;
    existing.isOpen = data.isOpen;
    if (!existing.createdBy) existing.createdBy = createdBy;
    await existing.save();
    return { restaurant: existing, created: false };
  }

  const createdRestaurant = await Restaurant.create({ ...data, createdBy });
  return { restaurant: createdRestaurant, created: true };
};

const ensureMenuItems = async (restaurantId, items) => {
  for (const item of items) {
    // Upsert by name per restaurant so seed is idempotent but can still refresh images/flags.
    await MenuItem.updateOne(
      { restaurant: restaurantId, name: item.name },
      {
        $set: {
          ...item,
          restaurant: restaurantId,
        },
      },
      { upsert: true }
    );
  }
};

const stableHash = (input) => {
  const text = String(input ?? "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const FOOD_PHOTOS = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=80",
];

const foodPic = (sigKey) => {
  const idx = stableHash(sigKey) % FOOD_PHOTOS.length;
  return FOOD_PHOTOS[idx];
};

const seed = async () => {
  await connectDB();

  const owner = await ensureUser({
    email: "seed-restaurant@foodex.local",
    name: "Foodex Partner",
    password: "password123",
    role: ROLES.RESTAURANT,
  });

  const restaurants = [
    {
      name: "Dragon Bowl",
      description: "Wok-fired Chinese classics, noodles, and dim sum.",
      cuisine: ["Chinese", "Asian"],
      contactPhone: "+91-9000000002",
      imageUrl: foodPic("restaurant:Dragon Bowl"),
      address: {
        line1: "77 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        location: { lat: 12.9758, lng: 77.6047 },
      },
      menu: [
        {
          name: "Schezwan Chicken Noodles",
          description: "Smoky wok-tossed noodles with a spicy kick.",
          category: "Noodles",
          price: 249,
          isVeg: false,
          recommended: true,
          isTodaySpecial: true,
          imageUrl: foodPic("menu:Schezwan Chicken Noodles"),
        },
        {
          name: "Veg Manchurian",
          description: "Crisp veg balls in a glossy garlic sauce.",
          category: "Starters",
          price: 219,
          isVeg: true,
          recommended: true,
          imageUrl: foodPic("menu:Veg Manchurian"),
        },
        {
          name: "Chilli Paneer",
          description: "Paneer cubes tossed with peppers and chilli.",
          category: "Starters",
          price: 269,
          isVeg: true,
          isTodaySpecial: true,
          imageUrl: foodPic("menu:Chilli Paneer"),
        },
      ],
    },
    {
      name: "Pasta Street",
      description: "Comforting pastas, wood-fired pizzas, and gelato.",
      cuisine: ["Italian", "Pizza"],
      contactPhone: "+91-9000000011",
      imageUrl: foodPic("restaurant:Pasta Street"),
      address: {
        line1: "3 Church Street",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        location: { lat: 12.9736, lng: 77.6086 },
      },
      menu: [
        {
          name: "Truffle Mushroom Pizza",
          description: "Crisp base, mushrooms, truffle aroma.",
          category: "Pizza",
          price: 399,
          isVeg: true,
          recommended: true,
          isTodaySpecial: true,
          imageUrl: foodPic("menu:Truffle Mushroom Pizza"),
        },
        {
          name: "Alfredo Penne",
          description: "Creamy parmesan sauce with butter-smooth finish.",
          category: "Pasta",
          price: 329,
          isVeg: true,
          recommended: true,
          imageUrl: foodPic("menu:Alfredo Penne"),
        },
        {
          name: "Arrabbiata Spaghetti",
          description: "Tomato, garlic, chilli — clean heat.",
          category: "Pasta",
          price: 319,
          isVeg: true,
          imageUrl: foodPic("menu:Arrabbiata Spaghetti"),
        },
      ],
    },
    {
      name: "Biryani Bay",
      description: "Slow-cooked biryanis and kebabs with real aroma.",
      cuisine: ["Biryani", "North Indian"],
      contactPhone: "+91-9000000022",
      imageUrl: foodPic("restaurant:Biryani Bay"),
      address: {
        line1: "12 Koramangala",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560034",
        location: { lat: 12.9352, lng: 77.6245 },
      },
      menu: [
        {
          name: "Chicken Dum Biryani",
          description: "Fragrant basmati with tender chicken.",
          category: "Biryani",
          price: 349,
          isVeg: false,
          recommended: true,
          isTodaySpecial: true,
          imageUrl: foodPic("menu:Chicken Dum Biryani"),
        },
        {
          name: "Veg Hyderabadi Biryani",
          description: "Spiced rice with garden veggies.",
          category: "Biryani",
          price: 289,
          isVeg: true,
          recommended: true,
          imageUrl: foodPic("menu:Veg Hyderabadi Biryani"),
        },
        {
          name: "Seekh Kebab",
          description: "Juicy kebabs with mint chutney.",
          category: "Starters",
          price: 299,
          isVeg: false,
          imageUrl: foodPic("menu:Seekh Kebab"),
        },
      ],
    },
    {
      name: "Dosa District",
      description: "Crisp dosas, filter coffee, and South Indian comfort.",
      cuisine: ["South Indian"],
      contactPhone: "+91-9000000033",
      imageUrl: foodPic("restaurant:Dosa District"),
      address: {
        line1: "22 Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560038",
        location: { lat: 12.9719, lng: 77.6412 },
      },
      menu: [
        {
          name: "Masala Dosa",
          description: "Golden dosa with potato masala.",
          category: "Dosa",
          price: 159,
          isVeg: true,
          recommended: true,
          isTodaySpecial: true,
          imageUrl: foodPic("menu:Masala Dosa"),
        },
        {
          name: "Idli Sambar",
          description: "Soft idlis with hot sambar.",
          category: "Breakfast",
          price: 119,
          isVeg: true,
          imageUrl: foodPic("menu:Idli Sambar"),
        },
        {
          name: "Filter Coffee",
          description: "Strong, frothy, classic.",
          category: "Beverages",
          price: 69,
          isVeg: true,
          imageUrl: foodPic("menu:Filter Coffee"),
        },
      ],
    },
    {
      name: "Sushi Harbor",
      description: "Clean flavors, fresh sushi rolls, and miso comfort.",
      cuisine: ["Japanese", "Sushi"],
      contactPhone: "+91-9000000044",
      imageUrl: foodPic("restaurant:Sushi Harbor"),
      address: {
        line1: "9 Lavelle Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        location: { lat: 12.9754, lng: 77.5999 },
      },
      menu: [
        {
          name: "Spicy Ramen Bowl",
          description: "Deep broth with clean heat.",
          category: "Ramen",
          price: 289,
          isVeg: false,
          recommended: true,
          isTodaySpecial: true,
          imageUrl: foodPic("menu:Spicy Ramen Bowl"),
        },
        {
          name: "California Roll",
          description: "Crab, avocado, cucumber.",
          category: "Sushi",
          price: 349,
          isVeg: false,
          recommended: true,
          imageUrl: foodPic("menu:California Roll"),
        },
        {
          name: "Miso Soup",
          description: "Comforting miso with tofu.",
          category: "Soup",
          price: 129,
          isVeg: true,
          imageUrl: foodPic("menu:Miso Soup"),
        },
      ],
    },
  ];

  let createdCount = 0;

  for (const r of restaurants) {
    const result = await upsertRestaurant(owner._id, {
      name: r.name,
      description: r.description,
      cuisine: r.cuisine,
      contactPhone: r.contactPhone,
      imageUrl: r.imageUrl,
      address: r.address,
      isOpen: true,
    });

    if (result.created) createdCount += 1;

    await ensureMenuItems(result.restaurant._id, r.menu);
  }

  console.log(`Seed complete. Restaurants ensured: ${restaurants.length}. Newly created: ${createdCount}.`);

  await mongoose.connection.close();
};

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  try {
    await mongoose.connection.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
