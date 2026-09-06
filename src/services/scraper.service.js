const Category = require("../models/category.model");
const { fetchProductListings } = require("../crawlers/listing.crawler");
const { saveProducts } = require("./product.service");
const logger = require("../utils/logger");

async function syncProductListings() {
  const categories = await Category.find().lean();

  logger.info(`Found ${categories.length} categories`);

  for (const category of categories) {
    logger.info(`\n📂 ${category.name}`);

    const products = await fetchProductListings(category);

    logger.info(`Found ${products.length} products`);

    await saveProducts(products);
  }

  logger.info("Listing Sync Completed");
}

module.exports = {
  syncProductListings,
};