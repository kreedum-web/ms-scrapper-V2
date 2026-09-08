const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    // Source Info
    supplier: {
      type: String,
      required: true,
      index: true,
    },

    categorySlug: {
      type: String,
      required: true,
      index: true,
    },

    categoryName: {
      type: String,
      required: true,
    },

    // Listing Info
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    url: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // ---------- DETAIL DATA ----------

    brand: String,

    sku: String,

    shortDescription: String,

    descriptionHtml: String,

    descriptionText: String,

    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    features: {
      type: [String],
      default: [],
    },

    images: {
      type: [String],
      default: [],
    },

    thumbnail: String,

    mrp: Number,

    sellingPrice: Number,

    currency: {
      type: String,
      default: "INR",
    },

    
    // ---------- SCRAPER ----------

    status: {
      type: String,
      enum: ["pending", "scraped", "failed"],
      default: "pending",
      index: true,
    },

    lastScrapedAt: Date,

    status: {
  type: String,
  enum: ["active", "inactive"],
  default: "active",
},

removedAt: {
  type: Date,
  default: null,
},

    lastError: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);