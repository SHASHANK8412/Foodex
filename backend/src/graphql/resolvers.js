const { GraphQLError } = require("graphql");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const User = require("../models/User");
const orderService = require("../services/orderService");
const ROLES = require("../constants/roles");
const { pubsub, ORDER_STATUS_UPDATED } = require("./subscriptionBus");

const asGraphId = (doc) => ({ ...doc.toObject(), id: String(doc._id) });

const ensureAuth = (user) => {
  if (!user) {
    throw new GraphQLError("Unauthorized");
  }
};

const resolvers = {
  Query: {
    restaurants: async (_root, _args, ctx) => {
      const user = ctx.user;
      if (user?.role === ROLES.OWNER) {
        const docs = await Restaurant.find({ ownerId: user.userId }).sort({ createdAt: -1 });
        return docs.map(asGraphId);
      }
      const docs = await Restaurant.find({}).sort({ createdAt: -1 });
      return docs.map(asGraphId);
    },
    restaurant: async (_root, { id }, ctx) => {
      const user = ctx.user;
      const query = { _id: id };
      if (user?.role === ROLES.OWNER) {
        query.ownerId = user.userId;
      }
      const doc = await Restaurant.findOne(query);
      return doc ? asGraphId(doc) : null;
    },
    menuByRestaurant: async (_root, { restaurantId }, ctx) => {
      const user = ctx.user;
      if (user?.role === ROLES.OWNER) {
        const restaurant = await Restaurant.findOne({ _id: restaurantId, ownerId: user.userId });
        if (!restaurant) {
          throw new GraphQLError("Forbidden");
        }
      }
      const docs = await MenuItem.find({ restaurant: restaurantId });
      return docs.map(asGraphId);
    },
    myOrders: async (_root, _args, ctx) => {
      ensureAuth(ctx.user);
      const query = ctx.user.role === ROLES.ADMIN ? {} : { user: ctx.user.userId };
      const docs = await Order.find(query).sort({ createdAt: -1 }).limit(100);
      return docs.map(asGraphId);
    },
    users: async (_root, _args, ctx) => {
      ensureAuth(ctx.user);
      if (ctx.user.role !== ROLES.ADMIN) {
        throw new GraphQLError("Forbidden");
      }
      const docs = await User.find({});
      return docs.map(asGraphId);
    },
  },
  Mutation: {
    createOrder: async (_root, { input }, ctx) => {
      ensureAuth(ctx.user);
      const result = await orderService.createOrder({
        userId: ctx.user.userId,
        restaurantId: input.restaurantId,
        items: input.items,
        deliveryAddress: {
          line1: input.line1,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          location: {
            lat: input.lat,
            lng: input.lng,
          },
        },
      });
      return asGraphId(result.order);
    },
    toggleFeaturedMenuItem: async (_root, { menuItemId, featured }, ctx) => {
      ensureAuth(ctx.user);
      if (![ROLES.ADMIN, ROLES.OWNER].includes(ctx.user.role)) {
        throw new GraphQLError("Forbidden");
      }

      const menuItem = await MenuItem.findById(menuItemId).populate("restaurant", "ownerId");
      if (!menuItem) {
        throw new GraphQLError("Menu item not found");
      }

      if (ctx.user.role === ROLES.OWNER && String(menuItem.restaurant?.ownerId) !== String(ctx.user.userId)) {
        throw new GraphQLError("Forbidden");
      }

      menuItem.featured = featured;
      await menuItem.save();
      return asGraphId(menuItem);
    },
  },
  Subscription: {
    orderStatusUpdated: {
      subscribe: async function* (_root, { orderId }, ctx) {
        ensureAuth(ctx.user);
        const iterator = await pubsub.asyncIterator(ORDER_STATUS_UPDATED);
        for await (const payload of iterator) {
          if (String(payload.orderStatusUpdated?._id) === String(orderId)) {
            yield payload;
          }
        }
      },
    },
  },
  Order: {
    restaurant: async (order, _args, ctx) => {
      if (!order.restaurant) return null;
      const doc = await ctx.loaders.restaurantById.load(String(order.restaurant));
      return doc ? asGraphId(doc) : null;
    },
    user: async (order, _args, ctx) => {
      if (!order.user) return null;
      const doc = await ctx.loaders.userById.load(String(order.user));
      return doc ? asGraphId(doc) : null;
    },
  },
};

module.exports = resolvers;
