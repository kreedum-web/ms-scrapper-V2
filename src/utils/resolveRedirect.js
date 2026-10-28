const axios = require("axios");

const config = require("../config/scraper.config");

/**
 * Where does `url` permanently redirect to? Returns the absolute target of a
 * 301/308 redirect, or null (no redirect, 404, network error...).
 *
 * Metro Sports renames product URLs from time to time
 * ("/product/aerobic-stepper-2/" -> "/product/aerofit-aerobic-stepper-af-001as/")
 * and leaves a 301 behind; following it keeps the product's identity.
 */
async function resolveRedirect(url) {
  try {
    const response = await axios.get(url, {
      maxRedirects: 0,
      timeout: 20000,
      headers: config.headers,
      validateStatus: (status) => status < 500,
    });

    if ([301, 308].includes(response.status) && response.headers.location) {
      return new URL(response.headers.location, url).href;
    }
  } catch {
    // Unreachable: treat as "no redirect known".
  }
  return null;
}

module.exports = resolveRedirect;
