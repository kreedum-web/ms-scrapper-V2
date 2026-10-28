const Category = require("../models/category.model");
const logger = require("../utils/logger");

/**
 * Save Metro's category tree (from crawlMenu).
 *
 * Matched by URL, so an existing category whose slug changes
 * ("weights-bars/dumbbells" -> "dumbbells") is updated, not duplicated.
 * Categories no longer in the menu are marked inactive, never deleted.
 */
async function saveCategoryTree(nodes, supplier = "metrosports") {
  if (!nodes.length) {
    throw new Error("Refusing to save an empty category tree.");
  }

  // A slug that moved to a new URL must free up its old document first,
  // otherwise the unique {supplier, slug} index rejects the update.
  const urls = nodes.map((n) => n.url);
  await Category.updateMany(
    { supplier, url: { $nin: urls }, slug: { $in: nodes.map((n) => n.slug) } },
    [{ $set: { slug: { $concat: ["$slug", "--retired-", { $toString: "$_id" }] }, isActive: false } }]
  );

  const operations = nodes.map((node) => ({
    updateOne: {
      filter: { supplier, url: node.url },
      update: { $set: node },
      upsert: true,
    },
  }));

  const result = await Category.bulkWrite(operations, { ordered: false });

  const deactivated = await Category.updateMany(
    { supplier, url: { $nin: urls }, isActive: true },
    { $set: { isActive: false } }
  );

  logger.info(
    `✅ Categories: ${result.upsertedCount} new | ${result.modifiedCount} updated | ${deactivated.modifiedCount} no longer in menu`
  );

  return result;
}

/** Old flat save, kept for compatibility. */
async function saveCategories(categories) {
  return saveCategoryTree(categories);
}

/** Categories whose pages list products (departments + categories, not menu headings). */
async function getCategories(supplier = "metrosports") {
  return Category.find({ supplier, isActive: true, kind: { $ne: "group" } })
    .sort({ level: 1, displayOrder: 1 })
    .lean();
}

/** The whole active tree, including menu headings. */
async function getCategoryTree(supplier = "metrosports") {
  return Category.find({ supplier, isActive: true })
    .sort({ level: 1, displayOrder: 1 })
    .lean();
}

module.exports = {
  saveCategoryTree,
  saveCategories,
  getCategories,
  getCategoryTree,
};
