const request = async (url, retries = config.retryAttempts || 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.debug(`GET ${url}`);

      const response = await client.get(url);

      await delay(config.requestDelay);

      return response.data;
    } catch (err) {
      logger.warn(
        `Retry ${attempt}/${retries} → ${url}`
      );

      if (attempt === retries) {
        logger.error(`Request failed → ${url}`);
        throw err;
      }

      await delay(config.retryDelay);
    }
  }
};



module.exports = request;