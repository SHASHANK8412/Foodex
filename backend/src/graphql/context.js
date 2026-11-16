const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const { createLoaders } = require("./loaders");

const buildGraphqlContext = async ({ req }) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let user = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, env.jwtSecret);
      user = await User.findById(decoded.userId).select("_id role email name isActive");
      if (!user?.isActive) {
        user = null;
      }
    } catch (_error) {
      user = null;
    }
  }

  return {
    user,
    loaders: createLoaders(),
  };
};

module.exports = {
  buildGraphqlContext,
};
