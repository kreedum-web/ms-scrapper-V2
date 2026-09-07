const cron = require("node-cron");

const logger = require("../utils/logger");
const scraperConfig = require("../config/scraper.config");

const { syncListings } = require("../services/scraper.service");
const { isSyncRunning } = require("../services/sync.service");

function startDailyScheduler() {
  logger.info("🕒 Daily Scheduler Started");
  logger.info(`⏰ Cron: ${scraperConfig.schedulerCron}`);

  cron.schedule(scraperConfig.schedulerCron, async () => {
    logger.info("⏰ Daily sync triggered");

    try {
      const running = await isSyncRunning("metrosports");

      if (running) {
        logger.warn("⚠️ Previous sync still running. Skipping this run.");
        return;
      }

      await syncListings();

      logger.info("✅ Scheduled sync completed.");
    } catch (error) {
      logger.error("❌ Scheduled sync failed.");
      logger.error(error.stack || error.message);
    }
  });
}

module.exports = {
  startDailyScheduler,
};