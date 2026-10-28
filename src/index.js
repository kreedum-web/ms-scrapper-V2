require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const logger = require("./utils/logger");

const crawlMenu = require("./crawlers/menu.crawler");

const {
  saveCategoryTree,
} = require("./services/category.service");

const {
  startDailyScheduler,
} = require("./scheduler/daily.scheduler");
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

      // Metro's full menu tree: departments, categories, sub-categories.
      const nodes = await crawlMenu(process.env.BASE_URL);
      await saveCategoryTree(nodes);
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

if (args.includes("--scheduler")) {
  logger.info("🕒 Starting Daily Scheduler");

  startDailyScheduler();

  // Keep Node process alive.
 return new Promise(() => {});}

  } catch (error) {
    logger.error(error.stack || error.message);
    process.exitCode = 1;
  } finally {
  // Don't disconnect when scheduler is running.
  if (!process.argv.includes("--scheduler")) {
    await mongoose.disconnect();
    logger.info("👋 MongoDB Disconnected");
  }
}
}

main();