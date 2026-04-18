const connectDB = require("../config/db");
const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const ROLES = require("../constants/roles");
const mongoose = require("mongoose");

const usersSeed = [
  {
    name: "Foodex Admin",
    email: "admin@foodex.com",
    password: "admin123",
    role: ROLES.ADMIN,
  },
  {
    name: "Urban Spice Owner",
    email: "owner.indian@foodex.com",
    password: "owner123",
    role: ROLES.OWNER,
  },
  {
    name: "Dragon Bowl Owner",
    email: "owner.chinese@foodex.com",
    password: "owner123",
    role: ROLES.OWNER,
  },
  {
    name: "Pasta Street Owner",
    email: "owner.italian@foodex.com",
    password: "owner123",
    role: ROLES.OWNER,
  },
  {
    name: "Foodex User",
    email: "user@foodex.com",
    password: "user123",
    role: ROLES.USER,
  },
];

const buildRestaurants = (owners, adminId) => {
  return [
    {
      name: "Urban Spice Kitchen",
      description: "Modern Indian kitchen with rich curries and tandoor specials.",
      imageUrl: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1200&q=80",
      cuisine: ["Indian", "North Indian"],
      address: {
        line1: "12 Residency Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560025",
        location: { lat: 12.9716, lng: 77.5946 },
      },
      contactPhone: "+91-9000000001",
      isOpen: true,
      avgPrepMinutes: 24,
      demandLevel: "medium",
      estimatedWaitMinutes: 28,
      createdBy: adminId,
      ownerId: owners.indian,
      featured: true,
      promotions: [
        {
          title: "Weeknight Feast",
          code: "SPICE15",
          discountPercent: 15,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
          active: true,
        },
      ],
    },
    {
      name: "Dragon Bowl",
      description: "Wok-fired Chinese classics, noodles, and dim sum.",
      imageUrl: "https://images.unsplash.com/photo-1563379091339-03246963d0ef?auto=format&fit=crop&w=1200&q=80",
      cuisine: ["Chinese", "Asian"],
      address: {
        line1: "77 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        location: { lat: 12.9758, lng: 77.6047 },
      },
      contactPhone: "+91-9000000002",
      isOpen: true,
      avgPrepMinutes: 20,
      demandLevel: "high",
      estimatedWaitMinutes: 30,
      createdBy: adminId,
      ownerId: owners.chinese,
      featured: true,
    },
    {
      name: "Pasta Street",
      description: "Authentic Italian pastas, pizzas, and desserts.",
      imageUrl: "https://images.unsplash.com/photo-1481931098730-318b6f776db0?auto=format&fit=crop&w=1200&q=80",
      cuisine: ["Italian", "Continental"],
      address: {
        line1: "3 Church Street",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        location: { lat: 12.9736, lng: 77.6086 },
      },
      contactPhone: "+91-9000000003",
      isOpen: true,
      avgPrepMinutes: 26,
      demandLevel: "low",
      estimatedWaitMinutes: 22,
      createdBy: adminId,
      ownerId: owners.italian,
      featured: false,
    },
  ];
};

const buildMenuItems = (restaurantsByName) => {
  return [
    {
      restaurant: restaurantsByName["Urban Spice Kitchen"]._id,
      name: "Butter Chicken",
      description: "Creamy tomato gravy with charcoal grilled chicken.",
      category: "Main Course",
      price: 299,
      isVeg: false,
      isAvailable: true,
      recommended: true,
      isFeatured: true,
      spiceLevel: "medium",
      prepTime: 22,
      tags: ["indian", "creamy", "popular"],
      sortOrder: 1,
    },
    {
      restaurant: restaurantsByName["Urban Spice Kitchen"]._id,
      name: "Paneer Tikka Masala",
      description: "Smoky paneer cubes in rich onion tomato gravy.",
      category: "Main Course",
      price: 269,
      isVeg: true,
      isAvailable: true,
      recommended: true,
      spiceLevel: "medium",
      prepTime: 18,
      tags: ["veg", "indian", "paneer"],
      sortOrder: 2,
    },
    {
      restaurant: restaurantsByName["Urban Spice Kitchen"]._id,
      name: "Chicken Biryani",
      description: "Aromatic dum biryani with tender spicy chicken.",
      category: "Rice",
      price: 279,
      isVeg: false,
      isAvailable: true,
      recommended: true,
      spiceLevel: "hot",
      prepTime: 28,
      tags: ["spicy", "rice", "biryani"],
      sortOrder: 3,
    },
    {
      restaurant: restaurantsByName["Dragon Bowl"]._id,
      name: "Schezwan Chicken Noodles",
      description: "Wok tossed noodles with bold schezwan chilli kick.",
      category: "Noodles",
      price: 249,
      isVeg: false,
      isAvailable: true,
      recommended: true,
      spiceLevel: "hot",
      prepTime: 16,
      tags: ["spicy", "noodles", "chinese"],
      sortOrder: 1,
    },
    {
      restaurant: restaurantsByName["Dragon Bowl"]._id,
      name: "Veg Hakka Noodles",
      description: "Classic street-style veg noodles with soy and garlic.",
      category: "Noodles",
      price: 199,
      isVeg: true,
      isAvailable: true,
      recommended: false,
      spiceLevel: "mild",
      prepTime: 14,
      tags: ["veg", "chinese", "quick"],
      sortOrder: 2,
    },
    {
      restaurant: restaurantsByName["Dragon Bowl"]._id,
      name: "Kung Pao Chicken",
      description: "Spicy stir-fried chicken with peanuts and peppers.",
      category: "Main Course",
      price: 289,
      isVeg: false,
      isAvailable: true,
      recommended: true,
      spiceLevel: "hot",
      prepTime: 20,
      tags: ["spicy", "chicken", "main course"],
      sortOrder: 3,
    },
    {
      restaurant: restaurantsByName["Pasta Street"]._id,
      name: "Arrabbiata Penne",
      description: "Penne in spicy tomato basil sauce with parmesan.",
      category: "Pasta",
      price: 259,
      isVeg: true,
      isAvailable: true,
      recommended: true,
      spiceLevel: "hot",
      prepTime: 17,
      tags: ["italian", "veg", "spicy"],
      sortOrder: 1,
    },
    {
      restaurant: restaurantsByName["Pasta Street"]._id,
      name: "Margherita Pizza",
      description: "Classic mozzarella pizza with basil and tomato.",
      category: "Pizza",
      price: 299,
      isVeg: true,
      isAvailable: true,
      recommended: true,
      spiceLevel: "mild",
      prepTime: 20,
      tags: ["italian", "pizza", "veg"],
      sortOrder: 2,
    },
    {
      restaurant: restaurantsByName["Pasta Street"]._id,
      name: "Chicken Alfredo Pasta",
      description: "Creamy alfredo sauce with grilled chicken strips.",
      category: "Pasta",
      price: 329,
      isVeg: false,
      isAvailable: true,
      recommended: false,
      spiceLevel: "mild",
      prepTime: 19,
      tags: ["italian", "chicken", "creamy"],
      sortOrder: 3,
    },
  ];
};

const seedDemoData = async ({ force = false } = {}) => {
  if (mongoose.connection.readyState === 0) {
    await connectDB();
  }

  if (!force) {
    const restaurantCount = await Restaurant.countDocuments();
    if (restaurantCount > 0) {
      return { seeded: false, reason: "restaurants already exist" };
    }
  }

  await MenuItem.deleteMany({});
  await Restaurant.deleteMany({});
  await User.deleteMany({ email: { $in: usersSeed.map((user) => user.email) } });

  const createdUsers = [];
  for (const payload of usersSeed) {
    const user = await User.create(payload);
    createdUsers.push(user);
  }
  const userMap = Object.fromEntries(createdUsers.map((user) => [user.email, user]));

  const restaurants = await Restaurant.insertMany(
    buildRestaurants(
      {
        indian: userMap["owner.indian@foodex.com"]._id,
        chinese: userMap["owner.chinese@foodex.com"]._id,
        italian: userMap["owner.italian@foodex.com"]._id,
      },
      userMap["admin@foodex.com"]._id
    )
  );

  const restaurantsByName = Object.fromEntries(restaurants.map((restaurant) => [restaurant.name, restaurant]));
  await MenuItem.insertMany(buildMenuItems(restaurantsByName));

  console.log("Demo users seeded:");
  console.log("admin@foodex.com / admin123");
  console.log("owner.indian@foodex.com / owner123");
  console.log("owner.chinese@foodex.com / owner123");
  console.log("owner.italian@foodex.com / owner123");
  console.log("user@foodex.com / user123");
  console.log("Demo restaurants and menu items inserted successfully.");

  return { seeded: true };
};

const ensureDemoData = async () => seedDemoData({ force: false });

if (require.main === module) {
  seedDemoData({ force: true })
    .then(async () => {
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Demo data seeding failed:", error);
      process.exit(1);
    });
}

module.exports = {
  seedDemoData,
  ensureDemoData,
};
