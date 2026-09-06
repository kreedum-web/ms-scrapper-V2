const logger = require("../utils/logger");

const { getCategories } = require("./category.service");
const { fetchProductListings } = require("../crawlers/listing.crawler");
const { saveProductListings } = require("./product.service");

async function syncListings() {
  logger.info("🚀 Starting MetroSports Listing Sync");

  const categories = await getCategories("metrosports");

  logger.info(`📂 Categories Loaded: ${categories.length}`);

  // URL => Product
  const uniqueProducts = new Map();

  let duplicateCount = 0;
  let categoryCount = 0;

  for (const category of categories) {
    categoryCount++;

    logger.info(`[${categoryCount}/${categories.length}] ${category.name}`);

    try {
      const listings = await fetchProductListings(category);

      logger.info(`Found ${listings.length} listings`);

      for (const listing of listings) {
        if (uniqueProducts.has(listing.url)) {
          duplicateCount++;
          continue;
        }

        uniqueProducts.set(listing.url, listing);
      }
    } catch (err) {
      logger.error(`❌ ${category.name}`);
      logger.error(err.message);
    }
  }

  const products = [...uniqueProducts.values()];

  logger.info("");
  logger.info(`📦 Unique Products : ${products.length}`);
  logger.info(`♻️ Duplicates Removed : ${duplicateCount}`);

  const result = await saveProductListings(products);

  logger.info("");
  logger.info("=================================");
  logger.info("✅ LISTING SYNC COMPLETE");
  logger.info(`Categories Crawled : ${categories.length}`);
  logger.info(`Products Found      : ${products.length}`);
  logger.info(`Duplicates Removed  : ${duplicateCount}`);
  logger.info(`Inserted            : ${result.inserted}`);
  logger.info(`Updated             : ${result.updated}`);
  logger.info("=================================");
}

module.exports = {
  syncListings,
};