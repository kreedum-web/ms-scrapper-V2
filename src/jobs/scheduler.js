const cron = require("node-cron");
const logger = require("../utils/logger");
const config = require("../config/scraper.config");

const startScheduler = (scrapeFunction) => {
  logger.info(
    `⏰ Scheduler Started (${config.cronSchedule}) Timezone : ${config.timezone}`
  );

  cron.schedule(
    config.cronSchedule,
    async () => {
      logger.info("🚀 Scheduled Scrape Started");

      try {
        await scrapeFunction();
        logger.info("✅ Scheduled Scrape Finished");
      } catch (err) {
        logger.error(err.message);
      }
    },
    {
      timezone: config.timezone,
    }
  );
};

module.exports = startScheduler;