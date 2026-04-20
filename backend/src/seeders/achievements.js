const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Achievement = require("../models/Achievement");

const achievements = [
  {
    key: "FIRST_ORDER",
    name: "Welcome Aboard!",
    description: "Awarded for placing your very first order.",
    icon: "fas fa-hand-sparkles",
  },
  {
    key: "STREAK_3",
    name: "3-Day Streak",
    description: "Awarded for ordering on three consecutive days.",
    icon: "fas fa-fire",
  },
  {
    key: "NIGHT_OWL",
    name: "Night Owl",
    description: "Awarded for placing an order between 10 PM and 4 AM.",
    icon: "fas fa-moon",
  },
  {
    key: "BIG_SPENDER",
    name: "Big Spender",
    description: "Awarded for a single order over ₹2000.",
    icon: "fas fa-gem",
  },
  {
    key: "SPICE_LOVER",
    name: "Spice Lover",
    description: "Awarded for ordering 5 spicy items.",
    icon: "fas fa-pepper-hot",
  },
];

const seedAchievements = async () => {
  try {
    await connectDB();
    console.log("Database connected for seeding.");

    await Achievement.deleteMany({});
    console.log("Existing achievements cleared.");

    await Achievement.insertMany(achievements);
    console.log("Achievements have been seeded successfully!");
  } catch (error) {
    console.error("Error seeding achievements:", error);
  } finally {
    mongoose.disconnect();
    console.log("Database connection closed.");
  }
};

seedAchievements();
