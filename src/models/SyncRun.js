const mongoose = require("mongoose");

const syncRunSchema = new mongoose.Schema(
  {
    supplier: {
      type: String,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },

    startedAt: {
      type: Date,
      required: true,
    },

    finishedAt: Date,

    durationSeconds: Number,

    categoriesScanned: {
      type: Number,
      default: 0,
    },

    listingsFound: {
      type: Number,
      default: 0,
    },

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

    removed: {
      type: Number,
      default: 0,
    },

    notes: String,
  },
  {
    timestamps: true,
    collection: "sync_runs",
  },
  
);

module.exports = mongoose.model("SyncRun", syncRunSchema);