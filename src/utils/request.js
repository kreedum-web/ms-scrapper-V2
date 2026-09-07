const axios = require("axios");

const logger = require("./logger");
const config = require("../config/scraper.config");
const delay = require("./delay");

const client = axios.create({
  timeout: 20000,
  headers: config.headers,
});

const request = async (
  url,
  retries = config.retryAttempts || config.retryCount || 3
) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.debug(`GET ${url}`);

      const response = await client.get(url);

      await delay(config.requestDelay || 0);

      return response.data;
    } catch (err) {
      logger.warn(
        `Retry attempt ${attempt}/${retries} failed → ${url}`
      );

      if (attempt === retries) {
        logger.error(`Request failed → ${url}`);
        throw err;
      }

      await delay(config.retryDelay || 1500);
    }
  }
};

module.exports = request;