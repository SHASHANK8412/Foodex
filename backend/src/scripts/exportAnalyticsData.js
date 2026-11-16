// Exports MongoDB data for the Spark batch job.
//
//   npm run analytics:export
//
// Writes, under ANALYTICS_DATA_DIR (default ./analytics/data):
//   orders/orders.jsonl  one order per line, in the schema batch_features.py reads
//   catalog.json         restaurants, menus and customer ids, used by the
//                        synthetic data generator so generated orders reference
//                        the real catalogue

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const env = require("../config/env");
const connectDB = require("../config/db");
const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const User = require("../models/User");
const ROLES = require("../constants/roles");
const { ORDER_STATUS } = require("../constants/order");

const EARTH_RADIUS_KM = 6371;

const hasCoordinates = (location) =>
  Number.isFinite(location?.lat) && Number.isFinite(location?.lng);

const haversineKm = (from, to) => {
  if (!hasCoordinates(from) || !hasCoordinates(to)) {
    return null;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;

  return Number((2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))).toFixed(2));
};

const deliveryMinutes = (order) => {
  const delivered = (order.trackingEvents || []).find((event) => event.status === ORDER_STATUS.DELIVERED);
  if (!delivered?.timestamp || !order.createdAt) {
    return null;
  }

  const minutes = (new Date(delivered.timestamp) - new Date(order.createdAt)) / 60000;
  return minutes > 0 ? Number(minutes.toFixed(1)) : null;
};

const toOrderRow = (order, restaurant) => ({
  order_id: String(order._id),
  user_id: String(order.user),
  restaurant_id: String(order.restaurant),
  restaurant_name: restaurant?.name || "",
  city: restaurant?.address?.city || order.deliveryAddress?.city || "",
  created_at: new Date(order.createdAt).toISOString(),
  status: order.status,
  payment_status: order.paymentStatus,
  total_amount: order.totalAmount,
  item_count: (order.items || []).reduce((sum, item) => sum + item.quantity, 0),
  items: (order.items || []).map((item) => ({
    menu_item_id: String(item.menuItem),
    name: item.name,
    quantity: item.quantity,
    price: item.price,
  })),
  distance_km: haversineKm(restaurant?.address?.location, order.deliveryAddress?.location),
  delivery_minutes: deliveryMinutes(order),
});

const exportAnalyticsData = async () => {
  await connectDB();

  const dataDir = env.analyticsDataDir;
  const ordersDir = path.join(dataDir, "orders");
  fs.mkdirSync(ordersDir, { recursive: true });

  const restaurants = await Restaurant.find({}).select("name address").lean();
  const restaurantById = new Map(restaurants.map((item) => [String(item._id), item]));
  const menuItems = await MenuItem.find({}).select("name price category restaurant").lean();
  const customers = await User.find({ role: ROLES.USER }).select("_id").lean();

  const catalog = {
    exportedAt: new Date().toISOString(),
    restaurants: restaurants.map((restaurant) => ({
      id: String(restaurant._id),
      name: restaurant.name,
      city: restaurant.address?.city || "",
      lat: restaurant.address?.location?.lat ?? null,
      lng: restaurant.address?.location?.lng ?? null,
      menu: menuItems
        .filter((item) => String(item.restaurant) === String(restaurant._id))
        .map((item) => ({
          id: String(item._id),
          name: item.name,
          price: item.price,
          category: item.category || "",
        })),
    })),
    userIds: customers.map((customer) => String(customer._id)),
  };
  fs.writeFileSync(path.join(dataDir, "catalog.json"), JSON.stringify(catalog, null, 2));

  const ordersFile = path.join(ordersDir, "orders.jsonl");
  const stream = fs.createWriteStream(ordersFile, { encoding: "utf-8" });
  let orderCount = 0;

  // A cursor keeps memory flat however many orders there are.
  for await (const order of Order.find({}).lean().cursor()) {
    stream.write(`${JSON.stringify(toOrderRow(order, restaurantById.get(String(order.restaurant))))}\n`);
    orderCount += 1;
  }

  await new Promise((resolve, reject) => {
    stream.on("error", reject);
    stream.end(resolve);
  });

  console.log(`Exported ${orderCount} orders -> ${ordersFile}`);
  console.log(
    `Exported catalogue (${catalog.restaurants.length} restaurants, ${menuItems.length} menu items, ` +
      `${catalog.userIds.length} customers) -> ${path.join(dataDir, "catalog.json")}`
  );
};

if (require.main === module) {
  exportAnalyticsData()
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Export failed:", error.message);
      process.exit(1);
    });
}

module.exports = { exportAnalyticsData, toOrderRow, haversineKm };
