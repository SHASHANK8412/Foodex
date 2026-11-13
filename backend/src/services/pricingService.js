const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const Coupon = require("../models/Coupon");
const ApiError = require("../utils/ApiError");
const { PAYMENT_STATUS } = require("../constants/order");

// The single source of truth for what an order costs. The cart, the checkout
// page and order creation all call `quote`, so the amount a customer is shown
// is the amount they are charged.
//
// Coupons come from two places: platform coupons (the Coupon collection) and
// restaurant promotions set by owners (Restaurant.promotions).

const TAX_RATE = 0.05;
const DELIVERY_FEE = 40;

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const isWithinDates = ({ startsAt, endsAt }, now) =>
  (!startsAt || new Date(startsAt) <= now) && (!endsAt || new Date(endsAt) >= now);

const normalizeCode = (code) => (typeof code === "string" ? code.trim().toUpperCase() : "");

// Restaurant promotions are percent-off codes scoped to that restaurant.
const promotionAsCoupon = (restaurant, promotion) => ({
  code: normalizeCode(promotion.code),
  title: promotion.title || `${promotion.discountPercent}% off at ${restaurant.name}`,
  description: `Restaurant offer from ${restaurant.name}`,
  discountType: "percent",
  value: Number(promotion.discountPercent) || 0,
  minSubtotal: 0,
  restaurant: restaurant._id,
  startsAt: promotion.startsAt,
  endsAt: promotion.endsAt,
  active: promotion.active !== false,
  source: "restaurant",
});

const findCoupon = async (code, restaurant) => {
  const coupon = await Coupon.findOne({ code }).lean();
  if (coupon) {
    return { ...coupon, source: "platform" };
  }

  const promotion = (restaurant.promotions || []).find((item) => normalizeCode(item.code) === code);
  return promotion ? promotionAsCoupon(restaurant, promotion) : null;
};

const countUserCouponOrders = (userId, code) =>
  Order.countDocuments({ user: userId, couponCode: code, paymentStatus: { $ne: PAYMENT_STATUS.FAILED } });

const countUserPaidOrders = (userId) =>
  Order.countDocuments({ user: userId, paymentStatus: PAYMENT_STATUS.PAID });

// Returns null when the coupon applies, otherwise the reason it does not.
const couponRejection = async ({ coupon, restaurant, subtotal, userId, now }) => {
  if (!coupon || !coupon.active || !isWithinDates(coupon, now)) {
    return "This coupon code is not valid right now.";
  }
  if (coupon.restaurant && String(coupon.restaurant) !== String(restaurant._id)) {
    return "This coupon is for a different restaurant.";
  }
  if (subtotal < (coupon.minSubtotal || 0)) {
    return `Add items worth ₹${round2(coupon.minSubtotal - subtotal)} more to use this coupon.`;
  }
  if (coupon.firstOrderOnly || coupon.perUserLimit) {
    if (!userId) {
      return "Sign in to use this coupon.";
    }
    if (coupon.firstOrderOnly && (await countUserPaidOrders(userId)) > 0) {
      return "This coupon is only for your first order.";
    }
    if (coupon.perUserLimit && (await countUserCouponOrders(userId, coupon.code)) >= coupon.perUserLimit) {
      return "You have already used this coupon.";
    }
  }
  return null;
};

const discountFor = (coupon, subtotal) => {
  if (coupon.discountType === "free_delivery") {
    return { itemDiscount: 0, deliveryDiscount: DELIVERY_FEE };
  }

  const raw = coupon.discountType === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  const capped = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
  return { itemDiscount: round2(Math.min(capped, subtotal)), deliveryDiscount: 0 };
};

/**
 * Prices a basket. Item prices always come from the database, never from the client.
 *
 * @returns {{ restaurant, lines, subtotal, discount, deliveryFee, taxAmount, totalAmount, coupon }}
 * `coupon` is null when no code was given, otherwise { code, valid, reason?, title?, savings? }.
 */
const quote = async ({ restaurantId, items, couponCode, userId, now = new Date() }) => {
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Valid restaurantId is required");
  }
  if (!Array.isArray(items) || !items.length) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "At least one item is required");
  }

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant || !restaurant.isOpen) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Restaurant unavailable");
  }

  // Merge repeated lines for the same item.
  const quantities = new Map();
  items.forEach((item) => {
    const id = String(item.menuItemId);
    const quantity = Math.floor(Number(item.quantity));
    if (!mongoose.isValidObjectId(id) || !Number.isFinite(quantity) || quantity < 1 || quantity > 50) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Each item needs a valid menuItemId and a quantity from 1 to 50");
    }
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  });

  const menuItems = await MenuItem.find({
    _id: { $in: [...quantities.keys()] },
    restaurant: restaurant._id,
    isAvailable: true,
  });
  if (menuItems.length !== quantities.size) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Some menu items are unavailable");
  }

  const lines = menuItems.map((menuItem) => ({
    menuItem: menuItem._id,
    name: menuItem.name,
    quantity: quantities.get(String(menuItem._id)),
    price: menuItem.price,
  }));
  const subtotal = round2(lines.reduce((sum, line) => sum + line.price * line.quantity, 0));

  let applied = { itemDiscount: 0, deliveryDiscount: 0 };
  let coupon = null;
  const code = normalizeCode(couponCode);

  if (code) {
    const found = await findCoupon(code, restaurant);
    const reason = await couponRejection({ coupon: found, restaurant, subtotal, userId, now });
    if (reason) {
      coupon = { code, valid: false, reason };
    } else {
      applied = discountFor(found, subtotal);
      coupon = {
        code,
        valid: true,
        title: found.title,
        source: found.source,
        savings: round2(applied.itemDiscount + applied.deliveryDiscount),
      };
    }
  }

  const discountedSubtotal = round2(subtotal - applied.itemDiscount);
  const taxAmount = round2(discountedSubtotal * TAX_RATE);
  const deliveryFee = round2(DELIVERY_FEE - applied.deliveryDiscount);

  return {
    restaurant,
    lines,
    subtotal,
    discount: round2(applied.itemDiscount + applied.deliveryDiscount),
    deliveryFee,
    taxAmount,
    totalAmount: round2(discountedSubtotal + taxAmount + deliveryFee),
    coupon,
  };
};

// The public shape of a quote (no Mongoose documents).
const toQuoteResponse = (result) => ({
  restaurantId: String(result.restaurant._id),
  lines: result.lines.map((line) => ({
    menuItemId: String(line.menuItem),
    name: line.name,
    quantity: line.quantity,
    price: line.price,
    lineTotal: round2(line.price * line.quantity),
  })),
  subtotal: result.subtotal,
  discount: result.discount,
  deliveryFee: result.deliveryFee,
  taxAmount: result.taxAmount,
  totalAmount: result.totalAmount,
  coupon: result.coupon,
  taxRate: TAX_RATE,
});

// Offers that can currently be used, for the home page banners.
const listActiveOffers = async ({ now = new Date() } = {}) => {
  const coupons = await Coupon.find({ active: true }).populate("restaurant", "name").lean();
  const restaurants = await Restaurant.find({ isOpen: true, "promotions.0": { $exists: true } })
    .select("name promotions")
    .lean();

  const describe = (coupon) => {
    const parts = [];
    if (coupon.minSubtotal) parts.push(`on orders above ₹${coupon.minSubtotal}`);
    if (coupon.maxDiscount) parts.push(`up to ₹${coupon.maxDiscount} off`);
    if (coupon.firstOrderOnly) parts.push("first order only");
    if (coupon.restaurant?.name) parts.push(`at ${coupon.restaurant.name}`);
    return coupon.description || parts.join(", ");
  };

  const platform = coupons
    .filter((coupon) => isWithinDates(coupon, now))
    .map((coupon) => ({ code: coupon.code, title: coupon.title, sub: describe(coupon), source: "platform" }));

  const fromRestaurants = restaurants.flatMap((restaurant) =>
    (restaurant.promotions || [])
      .filter((promotion) => promotion.active !== false && promotion.code && isWithinDates(promotion, now))
      .map((promotion) => {
        const offer = promotionAsCoupon(restaurant, promotion);
        return { code: offer.code, title: offer.title, sub: `At ${restaurant.name}`, source: "restaurant" };
      })
  );

  return [...platform, ...fromRestaurants];
};

const DEMO_COUPONS = [
  {
    code: "FOODEX30",
    title: "30% off",
    description: "On orders above ₹299, up to ₹150 off",
    discountType: "percent",
    value: 30,
    maxDiscount: 150,
    minSubtotal: 299,
  },
  {
    code: "FASTFREE",
    title: "Free delivery",
    description: "No delivery fee on any order",
    discountType: "free_delivery",
  },
  {
    code: "WELCOME100",
    title: "₹100 off your first order",
    description: "First order only, above ₹199",
    discountType: "flat",
    value: 100,
    minSubtotal: 199,
    firstOrderOnly: true,
    perUserLimit: 1,
  },
];

// Idempotent: inserts the demo coupons that do not exist yet.
const ensureDemoCoupons = async () => {
  for (const coupon of DEMO_COUPONS) {
    await Coupon.updateOne({ code: coupon.code }, { $setOnInsert: coupon }, { upsert: true });
  }
};

module.exports = {
  TAX_RATE,
  DELIVERY_FEE,
  DEMO_COUPONS,
  quote,
  toQuoteResponse,
  listActiveOffers,
  ensureDemoCoupons,
};
