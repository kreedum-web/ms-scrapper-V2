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

    // Earlier URLs of this product (Metro renamed it and left a 301 redirect).
    previousUrls: {
      type: [String],
      default: [],
    },

    // ---------- NORMALIZATION ----------
    // Title exactly as Metro Sports shows it; `name` is the cleaned version.
    sourceName: String,

    // Every category page the product is listed on; `categorySlug` is the one chosen.
    categorySlugs: {
      type: [String],
      default: [],
    },

    // Category printed on the product page itself ("Category: DUAL STATIONS").
    postedIn: {
      type: [String],
      default: [],
    },

    // Slugs from department down to `categorySlug`, e.g. ["cardio", "treadmill", "commercial-treadmill"].
    categoryPath: {
      type: [String],
      default: [],
    },

    // "error:*" / "warn:*" / "fixed:*" codes from src/normalize/normalizeProduct.js.
    // Find problem products with: { dataIssues: /^error:/ }
    dataIssues: {
      type: [String],
      default: [],
      index: true,
    },

    normalizerVersion: Number,

    normalizedAt: Date,

    // ---------- SCRAPER ----------
    // The backend migration only reads products with status "active".
    // (This key was declared twice before; Mongoose kept only this one.)
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },

    lastScrapedAt: Date,

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