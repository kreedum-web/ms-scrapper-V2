module.exports = {
  supplier: process.env.SUPPLIER_NAME || "metrosports",
  baseUrl: process.env.BASE_URL,

  categoryConcurrency: Number(process.env.CATEGORY_CONCURRENCY || 5),
  pageConcurrency: Number(process.env.PAGE_CONCURRENCY || 5), // NEW
  concurrency: Number(process.env.SCRAPER_CONCURRENCY || 20),
  batchSize: Number(process.env.SCRAPER_BATCH_SIZE || 100),

  retryCount: Number(process.env.SCRAPER_RETRY_COUNT || 3),
  requestDelay: Number(process.env.REQUEST_DELAY_MS || 0),
};