const Category = require("../models/category.model");
const logger = require("../utils/logger");

async function saveCategories(categories) {
  if (!categories.length) return;

  const operations = categories.map((category) => ({
    updateOne: {
      filter: {
        supplier: category.supplier,
        slug: category.slug,
      },
      update: { $set: category },
      upsert: true,
    },
  }));

  const result = await Category.bulkWrite(operations);

  logger.info(`✅ Categories saved: ${categories.length}`);

  return result;
}

async function getCategories(supplier = "metrosports") {
  const categories = await Category.find({ supplier })
    .sort({ name: 1 })
    .lean();

  logger.info(`📂 Loaded ${categories.length} categories from MongoDB`);

  return categories;
}

module.exports = {
  saveCategories,
  getCategories,
};