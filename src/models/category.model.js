const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    supplier: {
      type: String,
      required: true,
      index: true,
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
    },

    image: String,

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

categorySchema.index({ supplier: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);