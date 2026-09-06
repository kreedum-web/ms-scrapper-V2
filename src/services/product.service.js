const Product = require("../models/product.model");
const logger = require("../utils/logger");

/**
 * Bulk insert/update product listing URLs.
 */
async function saveProductListings(products) {
  if (!products.length) {
    return {
      inserted: 0,
      updated: 0,
      total: 0,
    };
  }

  const operations = products.map((product) => ({
    updateOne: {
      filter: {
        supplier: product.supplier,
        url: product.url,
      },
      update: {
        $set: {
          supplier: product.supplier,
          categorySlug: product.categorySlug,
          categoryName: product.categoryName,
          name: product.name,
          slug: product.slug,
          url: product.url,
        },
        $setOnInsert: {
          status: "pending",
          lastScrapedAt: null,
          lastError: null,
        },
      },
      upsert: true,
    },
  }));

  const result = await Product.bulkWrite(operations, {
    ordered: false,
  });

  const inserted = result.upsertedCount || 0;
  const updated = result.modifiedCount || 0;

  logger.info(
    `💾 ${products.length} URLs processed | ${inserted} new | ${updated} updated`
  );

  return {
    inserted,
    updated,
    total: products.length,
  };
}

async function getPendingProducts(limit = 100) {
  return Product.find({ status: "pending" })
    .limit(limit)
    .lean();
}

module.exports = {
  saveProductListings,
  getPendingProducts,
};