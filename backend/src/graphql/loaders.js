const DataLoader = require("dataloader");
const Restaurant = require("../models/Restaurant");
const User = require("../models/User");

const createLoaders = () => ({
  restaurantById: new DataLoader(async (ids) => {
    const docs = await Restaurant.find({ _id: { $in: ids } });
    const map = new Map(docs.map((d) => [String(d._id), d]));
    return ids.map((id) => map.get(String(id)) || null);
  }),
  userById: new DataLoader(async (ids) => {
    const docs = await User.find({ _id: { $in: ids } });
    const map = new Map(docs.map((d) => [String(d._id), d]));
    return ids.map((id) => map.get(String(id)) || null);
  }),
});

module.exports = {
  createLoaders,
};
