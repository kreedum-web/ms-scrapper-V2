const pLimit = require("p-limit").default;
const scraperConfig = require("../config/scraper.config");


const logger = require("../utils/logger");
const { getCategories } = require("./category.service");
const { fetchProductListings } = require("../crawlers/listing.crawler");
const { fetchProductDetails } = require("../crawlers/product.crawler");
const {
  saveProductBatch,
  getExistingProducts,
} = require("./product.service");

const {
  startSyncRun,
  completeSyncRun,
  failSyncRun,
} = require("./sync.service");

// Product detail workers
const productLimit = pLimit(scraperConfig.concurrency);

// Category listing workers
const categoryLimit = pLimit(scraperConfig.categoryConcurrency);

async function syncListings() {
  const startedAt = Date.now();

  logger.info("🚀 Running Full Product Sync");

  const syncRun = await startSyncRun("metrosports");

  logger.info(`📝 Sync Run: ${syncRun._id}`);

    let categories = [];
  let existingProducts = new Map();

  let totalListings = 0;
  let totalSkipped = 0;

  let inserted = 0;
  let updated = 0;
  let processed = 0;

  const STALE_HOURS = 24;
const staleTime = Date.now() - STALE_HOURS * 60 * 60 * 1000;

  try {
    logger.info(`📂 Category Workers : ${scraperConfig.categoryConcurrency}`);
    logger.info(`🛒 Product Workers  : ${scraperConfig.concurrency}`);
    logger.info(`📦 Batch Size       : ${scraperConfig.batchSize}`);


     // Load categories and existing products
    [categories, existingProducts] = await Promise.all([
      getCategories("metrosports"),
      getExistingProducts(),
    ]);

    logger.info(`📂 Loaded ${categories.length} categories from MongoDB`);

const productMap = new Map();

await Promise.all(
  categories.map((category) =>
    categoryLimit(async () => {
      const listings = await fetchProductListings(category);

      totalListings += listings.length;

      for (const product of listings) {
        if (productMap.has(product.url)) continue;

        const existing = existingProducts.get(product.url);

        const shouldScrape =
          !existing ||
          !existing.lastScrapedAt ||
          new Date(existing.lastScrapedAt).getTime() < staleTime;

        if (shouldScrape) {
          productMap.set(product.url, product);
        } else {
          totalSkipped++;
        }
      }
    })
  )
);

// --------------------------------------
// STEP 2: Collect products to scrape
// --------------------------------------

const productsToScrape = [...productMap.values()];

logger.info(`🆕 Products To Scrape : ${productsToScrape.length}`);
logger.info(`⏭️ Products Skipped   : ${totalSkipped}`);

if (productsToScrape.length === 0) {
  logger.info("✅ Everything is already up-to-date.");
} else {

  const totalBatches = Math.ceil(
    productsToScrape.length / scraperConfig.batchSize
  );

  for (
    let i = 0;
    i < productsToScrape.length;
    i += scraperConfig.batchSize
  ) {
    const chunk = productsToScrape.slice(
      i,
      i + scraperConfig.batchSize
    );

    const batchNumber =
      Math.floor(i / scraperConfig.batchSize) + 1;

    logger.info(
      `📦 Batch ${batchNumber}/${totalBatches} • Scraping ${chunk.length} products...`
    );

    const detailedChunk = (
      await Promise.all(
        chunk.map((product) =>
          productLimit(async () => {
            try {
              return await fetchProductDetails(product);
            } catch (error) {
              logger.error(`❌ Failed: ${product.slug}`);

              return {
                ...product,
                status: "failed",
                lastError: error.message,
                lastScrapedAt: new Date(),
              };
            }
          })
        )
      )
    ).filter(Boolean);

    if (!detailedChunk.length) continue;

    const result = await saveProductBatch(detailedChunk);

    inserted += result.upsertedCount;
    updated += result.modifiedCount;
    processed += detailedChunk.length;

    const percent = Math.round(
      (processed / productsToScrape.length) * 100
    );

    logger.info(
      `💾 Batch ${batchNumber}/${totalBatches} saved • ${percent}% (${processed}/${productsToScrape.length})`
    );
  }
}

    // =====================================================
    // KEEP ALL YOUR EXISTING SCRAPER CODE HERE
    // (categories → listings → batching → saveProductBatch)
    // =====================================================

    await completeSyncRun(syncRun._id, {
      startedAt,

      categoriesScanned: categories.length,
      listingsFound: totalListings,

      productsScraped: processed,
      productsSkipped: totalSkipped,

      inserted,
      updated,
      failed: 0,
    });

    // --------------------------------------
    // STEP 3: Summary
    // --------------------------------------
    const duration = Math.round((Date.now() - startedAt) / 1000);

    logger.info(
      `⏱ Duration        : ${Math.floor(duration / 60)}m ${duration % 60}s`
    );

    logger.info("====================================");
    logger.info("✅ PRODUCT SYNC COMPLETE");
    logger.info(`Categories       : ${categories.length}`);
    logger.info(`Listings Scanned : ${totalListings}`);
    logger.info(`Products Scraped : ${processed}`);
    logger.info(`Products Skipped : ${totalSkipped}`);
    logger.info(`Inserted         : ${inserted}`);
    logger.info(`Updated          : ${updated}`);
    logger.info("====================================");

  } catch (error) {
    // Mark this sync run as failed in MongoDB
    await failSyncRun(syncRun._id, error);

    logger.error("====================================");
    logger.error("❌ PRODUCT SYNC FAILED");
    logger.error(error.stack || error.message);
    logger.error("====================================");

    // Re-throw so index.js can exit with code 1
    throw error;
  }
}

module.exports = {
  syncListings,
};