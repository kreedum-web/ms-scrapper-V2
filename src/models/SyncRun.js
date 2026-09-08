const mongoose = require("mongoose");

const syncRunSchema = new mongoose.Schema(
  {
    supplier: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },

    startedAt: Date,
    finishedAt: Date,
    durationSeconds: Number,

    // Listing stage
    categoriesScanned: {
      type: Number,
      default: 0,
    },

    listingsFound: {
      type: Number,
      default: 0,
    },

    // Product stage
    productsScraped: {
      type: Number,
      default: 0,
    },

    productsSkipped: {
      type: Number,
      default: 0,
    },

    inserted: {
      type: Number,
      default: 0,
    },

    updated: {
      type: Number,
      default: 0,
    },

    failed: {
      type: Number,
      default: 0,
    },

    // NEW — Live Progress Fields
    totalCategories: {
      type: Number,
      default: 0,
    },

    completedCategories: {
      type: Number,
      default: 0,
    },

    totalProducts: {
      type: Number,
      default: 0,
    },

    currentBatch: {
      type: Number,
      default: 0,
    },

    totalBatches: {
      type: Number,
      default: 0,
    },

    progressPercent: {
      type: Number,
      default: 0,
    },

    lastCategory: String,
    lastProductSlug: String,

    error: String,
  },
  {
    timestamps: true,
    collection: "sync_runs",
  }
);

module.exports = mongoose.model("SyncRun", syncRunSchema);