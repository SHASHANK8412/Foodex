const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    description: { 
      type: String, 
      trim: true 
    },
    category: { 
      type: String, 
      trim: true,
      required: true 
    },
    price: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    discountedPrice: { 
      type: Number, 
      min: 0 
    },
    tags: [{ 
      type: String, 
      trim: true 
    }],
    isVeg: { 
      type: Boolean, 
      default: false 
    },
    isAvailable: { 
      type: Boolean, 
      default: true 
    },
    isFeatured: { 
      type: Boolean, 
      default: false 
    },
    spiceLevel: {
      type: String,
      enum: ["mild", "medium", "hot"],
      default: "medium"
    },
    prepTime: { 
      type: Number, // in minutes
      default: 0 
    },
    image: {
      url: { 
        type: String, 
        trim: true 
      },
      publicId: { 
        type: String, 
        trim: true 
      }
    },
    nutritionInfo: {
      calories: { 
        type: Number, 
        min: 0 
      },
      protein: { 
        type: Number, 
        min: 0 
      },
      carbs: { 
        type: Number, 
        min: 0 
      }
    },
    sortOrder: { 
      type: Number, 
      default: 0 
    },
    estimatedCost: { 
      type: Number, 
      min: 0, 
      default: 0 
    },
    availabilityWindow: {
      type: String,
      enum: ["all_day", "breakfast", "lunch", "dinner"],
      default: "all_day",
    },
    embedding: [{ 
      type: Number 
    }],
    semanticText: { 
      type: String, 
      trim: true 
    },
    popularityScore: { 
      type: Number, 
      default: 0 
    },
    recommended: { 
      type: Boolean, 
      default: false 
    },
  },
  { timestamps: true }
);

// Index for sorting menu items
menuItemSchema.index({ restaurant: 1, sortOrder: 1 });
menuItemSchema.index({ restaurant: 1, category: 1 });
menuItemSchema.index({ restaurant: 1, isAvailable: 1 });

module.exports = mongoose.model("MenuItem", menuItemSchema);
