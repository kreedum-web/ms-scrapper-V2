const Product = require("../models/product.model");
const logger = require("../utils/logger");

/**
 * Save one batch of products using MongoDB bulkWrite.
 */
async function saveProductBatch(products) {
  if (!products.length) {
    return {
      upsertedCount: 0,
      modifiedCount: 0,
      matchedCount: 0,
    };
  }

  const operations = products.map((product) => ({
    updateOne: {
      filter: { url: product.url },
      update: { $set: product },
      upsert: true,
    },
  }));

  const result = await Product.bulkWrite(operations);

  logger.info(
    `Batch Saved: ${result.upsertedCount} new | ${result.modifiedCount} updated`
  );

  return result;
}

/**
 * Wrapper used by the current scraper.
 * (We'll replace this in Chapter 6.3.2B.)
 */
async function saveProducts(products) {
  return saveProductBatch(products);
}

/**
 * Load all existing products into a Map(url -> product)
 * Used for stale/new product detection.
 */
async function getExistingProducts() {
  const products = await Product.find(
    {},
    { url: 1, lastScrapedAt: 1 }
  ).lean();

  return new Map(products.map((product) => [product.url, product]));
}

module.exports = {
  saveProductBatch,
  saveProducts,
  getExistingProducts,
};