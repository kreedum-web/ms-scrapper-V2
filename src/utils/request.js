const axios = require("axios");
const logger = require("./logger");
const config = require("../config/scraper.config");

const delay = require("./delay");

const client = axios.create({
  timeout: 20000,
  headers: config.headers
});

const request = async (url, retries = config.retryAttempts) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`GET ${url}`);

      const response = await client.get(url);

      await delay(config.requestDelay);

      return response.data;
    } catch (err) {
      logger.error(
        `Attempt ${attempt}/${retries} failed : ${url}`
      );

      if (attempt === retries) throw err;

      await delay(config.retryDelay);
    }
  }
};

module.exports = request;