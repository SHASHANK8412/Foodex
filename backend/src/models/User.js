const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const ROLES = require("../constants/roles");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, minlength: 6, select: false },
    googleId: { type: String, index: true },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    phone: { type: String, trim: true },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    address: {
      line1: String,
      city: String,
      state: String,
      postalCode: String,
      location: {
        lat: Number,
        lng: Number,
      },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.password && !this.googleId) {
    throw new Error("Either password or googleId is required");
  }

  if (!this.isModified("password")) {
    return;
  }

  if (!this.password) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.generateAuthToken = function generateAuthToken() {
  return jwt.sign(
    {
      userId: this._id,
      role: this.role,
      email: this.email,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
};

module.exports = mongoose.model("User", userSchema);
