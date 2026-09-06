require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const logger = require("./utils/logger");

const {
  fetchCategories,
} = require("./crawlers/category.crawler");

const {
  saveCategories,
} = require("./services/category.service");

// const {
//   syncProductListings,
// } = require("./services/product.service");

const { syncListings } = require("./services/scraper.service");

async function main() {
  try {
    await connectDB();

    const args = process.argv.slice(2);

    if (args.includes("--categories")) {
      logger.info("🚀 Running Category Crawl");

      const categories = await fetchCategories(process.env.BASE_URL);
      logger.info(`📂 Categories discovered: ${categories.length}`);

      const result = await saveCategories(categories);
      logger.info(`✅ Categories saved: ${result.total}`);
      return;
    }

    // if (args.includes("--products")) {
    //   logger.info("🚀 Running Product Listing Sync");
    //   await syncProductListings();
    //   return;
    // }

    if (args.includes("--products")) {
  await syncListings();
  return;
}

  } catch (error) {
    logger.error(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    logger.info("👋 MongoDB Disconnected");
  }
}

main();