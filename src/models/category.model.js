const mongoose = require("mongoose");

/**
 * One node of Metro Sports' category tree (see src/crawlers/menu.crawler.js).
 * Built by `npm run categories`; read by the product sync and by the
 * backend's rebuildCatalog migration.
 */
const categorySchema = new mongoose.Schema(
  {
    supplier: {
      type: String,
      required: true,
      index: true,
    },

    // Display name ("Benches & Racks"); `sourceName` is as shown on Metro ("BENCHES & RACKS").
    name: {
      type: String,
      required: true,
    },

    sourceName: String,

    // Metro's URL slug, same as the product page's category ("dumbbells").
    slug: {
      type: String,
      required: true,
    },

    // Full path in Metro's URL ("weights-bars/dumbbells").
    sourceSlug: String,

    // Category page. Menu headings without a page get "#menu-group-<slug>".
    url: {
      type: String,
      required: true,
      unique: true,
    },

    // department (level 1) | category | group (menu heading, no own page)
    kind: {
      type: String,
      enum: ["department", "category", "group"],
      default: "category",
    },

    level: {
      type: Number,
      enum: [1, 2, 3],
    },

    parentSlug: {
      type: String,
      default: null,
    },

    rootSlug: String,

    // Slugs from department down to this node: ["cardio", "treadmill", "commercial-treadmill"]
    path: {
      type: [String],
      default: [],
    },

    // Position within its parent in Metro's menu.
    displayOrder: {
      type: Number,
      default: 0,
    },

    image: String,

    // false when the category is no longer in Metro's menu.
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
