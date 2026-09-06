const Product = require("../models/product.model");
const logger = require("../utils/logger");

async function saveProducts(products) {
  if (!products.length) return;

  const operations = products.map((product) => ({
    updateOne: {
      filter: { url: product.url },
      update: { $set: product },
      upsert: true,
    },
  }));

  const result = await Product.bulkWrite(operations);

  logger.info(
    `Products Saved: ${result.upsertedCount} new | ${result.modifiedCount} updated`
  );

  return result;
}

module.exports = {
  saveProducts,
};