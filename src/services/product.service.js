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
      reactivated: 0,
    };
  }

  // Find products that were inactive before this sync
  const urls = products.map((product) => product.url);

  const reactivated = await Product.countDocuments({
    supplier: "metrosports",
    status: "inactive",
    url: { $in: urls },
  });

  const operations = products.map((product) => ({
    updateOne: {
      filter: { url: product.url },
      update: {
        $set: {
          ...product,

          // Reactivate product if it exists again
          status: "active",
          removedAt: null,

          lastScrapedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));




  const result = await Product.bulkWrite(operations);

  logger.info(
    `Batch Saved: ${result.upsertedCount} new | ${result.modifiedCount} updated`
  );

  return {
    upsertedCount: result.upsertedCount,
    modifiedCount: result.modifiedCount,
    matchedCount: result.matchedCount,
    reactivated,
  };
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
     {
      url: 1,
      lastScrapedAt: 1,
      status: 1,
      removedAt: 1,
    }
  ).lean();

  return new Map(products.map((product) => [product.url, product]));
}

async function markRemovedProducts(liveUrls, supplier = "metrosports") {
  const result = await Product.updateMany(
    {
      supplier,
      status: "active",
      url: {
        $nin: [...liveUrls],
      },
    },
    {
      $set: {
        status: "inactive",
        removedAt: new Date(),
      },
    }
  );

  return result.modifiedCount;
}

module.exports = {
  saveProductBatch,
  saveProducts,
  getExistingProducts,
  markRemovedProducts,
};