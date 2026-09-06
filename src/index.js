require("dotenv").config();

const connectDB = require("./config/db");
const logger = require("./utils/logger");
const startScheduler = require("./jobs/scheduler");

const scrapeService = require("./services/scraper.service");

const start = async () => {
  await connectDB();

  const args = process.argv.slice(2);

  if (args.includes("--once")) {
    logger.info("🚀 Running One-Time Product Sync");
    await scrapeService.runProductSync();
    process.exit(0);
  }

  if (args.includes("--categories")) {
    logger.info("🚀 Running Category Crawl");
    await scrapeService.runCategorySync();
    process.exit(0);
  }

  logger.info("🚀 Kreedum Supplier Sync Started");

  startScheduler(scrapeService.runProductSync);
};

start();