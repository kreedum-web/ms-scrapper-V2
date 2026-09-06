const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
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

    name: {
      type: String,
      required: true,
    },

    slug: {
      type: String,
      required: true,
    },

    url: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "scraped", "failed"],
      default: "pending",
      index: true,
    },

    lastScrapedAt: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);