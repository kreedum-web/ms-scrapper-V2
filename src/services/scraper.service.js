const logger = require("../utils/logger");
const categoryService = require("./category.service");

const runCategorySync = async () => {
  logger.info("🚀 Starting Category Sync");

  await categoryService.saveCategories();

  logger.info("🎉 Category Sync Complete");
};

const runProductSync = async () => {
  logger.info("📦 Product crawler coming in Chapter 3.");
};

module.exports = {
  runCategorySync,
  runProductSync
};