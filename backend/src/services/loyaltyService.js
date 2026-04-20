const User = require("../models/User");
const Achievement = require("../models/Achievement");
const Leaderboard = require("../models/Leaderboard");
const { analyticsQueue } = require("../queues");

const POINTS_PER_RUPEE = 0.1; // 1 point per ₹10

const LEVEL_THRESHOLDS = {
  Bronze: 0,
  Silver: 1000,
  Gold: 5000,
  Platinum: 20000,
};

/**
 * Adds points to a user for a completed order and updates their streak.
 * @param {string} userId - The ID of the user.
 * @param {number} orderTotal - The total amount of the order.
 * @param {Date} orderDate - The date of the order.
 */
const addPointsForOrder = async (userId, orderTotal, orderDate) => {
  const user = await User.findById(userId);
  if (!user) return;

  const pointsEarned = Math.floor(orderTotal * POINTS_PER_RUPEE);
  user.loyalty.points += pointsEarned;

  // Update streak
  updateStreak(user, orderDate);

  // Check for level up
  updateUserLevel(user);

  await user.save();

  // Check for achievements
  await checkAndAwardBadges(userId, { orderTotal });

  // Enqueue analytics event
  analyticsQueue.add({
    event: "loyalty_points_earned",
    data: { userId, pointsEarned, newTotalPoints: user.loyalty.points },
  });
};

/**
 * Updates a user's ordering streak.
 * @param {User} user - The Mongoose user document.
 * @param {Date} orderDate - The date of the new order.
 */
const updateStreak = (user, orderDate) => {
  const today = new Date(orderDate);
  today.setHours(0, 0, 0, 0);

  const lastOrderDate = user.loyalty.streak.lastOrderDate
    ? new Date(user.loyalty.streak.lastOrderDate)
    : null;
  if (lastOrderDate) {
    lastOrderDate.setHours(0, 0, 0, 0);
  }

  if (lastOrderDate) {
    const diffTime = today.getTime() - lastOrderDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      user.loyalty.streak.current += 1;
    } else if (diffDays > 1) {
      user.loyalty.streak.current = 1; // Reset streak
    }
    // If diffDays is 0, it's the same day, do nothing to the streak.
  } else {
    user.loyalty.streak.current = 1;
  }

  user.loyalty.streak.lastOrderDate = orderDate;
};

/**
 * Updates a user's level based on their total points.
 * @param {User} user - The Mongoose user document.
 */
const updateUserLevel = (user) => {
  const points = user.loyalty.points;
  let newLevel = "Bronze";
  if (points >= LEVEL_THRESHOLDS.Platinum) {
    newLevel = "Platinum";
  } else if (points >= LEVEL_THRESHOLDS.Gold) {
    newLevel = "Gold";
  } else if (points >= LEVEL_THRESHOLDS.Silver) {
    newLevel = "Silver";
  }

  if (newLevel !== user.loyalty.level) {
    user.loyalty.level = newLevel;
    // Enqueue notification for level up
    analyticsQueue.add({
      event: "user_level_up",
      data: { userId: user._id, newLevel },
    });
  }
};

/**
 * Checks for and awards new badges to a user.
 * This is a simplified example. A real system would have more complex rule checks.
 * @param {string} userId - The ID of the user.
 * @param {object} context - Context about the event, e.g., { orderTotal: 500 }.
 */
const checkAndAwardBadges = async (userId, context) => {
  const user = await User.findById(userId).populate("loyalty.badges");
  if (!user) return;

  const userBadgeKeys = new Set(user.loyalty.badges.map((b) => b.key));

  // --- Badge Logic ---

  // 1. First Order Badge
  if (!userBadgeKeys.has("FIRST_ORDER")) {
    const achievement = await Achievement.findOne({ key: "FIRST_ORDER" });
    if (achievement) {
      user.loyalty.badges.push(achievement._id);
      userBadgeKeys.add(achievement.key);
      analyticsQueue.add({
        event: "badge_awarded",
        data: { userId, badgeKey: "FIRST_ORDER" },
      });
    }
  }

  // More badge logic would go here...
  // e.g., "NIGHT_OWL" if order is between 10 PM and 4 AM
  // e.g., "BIG_SPENDER" if orderTotal > 2000

  await user.save();
};

module.exports = {
  addPointsForOrder,
  checkAndAwardBadges,
  // ... other methods for leaderboard etc.
};
