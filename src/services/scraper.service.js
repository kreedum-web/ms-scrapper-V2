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

// Product detail workers
const productLimit = pLimit(scraperConfig.concurrency);

// Category listing workers
const categoryLimit = pLimit(scraperConfig.categoryConcurrency);

async function syncListings() {
  logger.info("🚀 Running Full Product Sync");
  logger.info(`📂 Category Workers : ${scraperConfig.categoryConcurrency}`);
  logger.info(`🛒 Product Workers  : ${scraperConfig.concurrency}`);
  logger.info(`📦 Batch Size       : ${scraperConfig.batchSize}`);

  // Load categories and existing products once
  const [categories, existingProducts] = await Promise.all([
    getCategories("metrosports"),
    getExistingProducts(),
  ]);

  logger.info(`📂 Loaded ${categories.length} categories from MongoDB`);

  const productMap = new Map();

  let totalListings = 0;
  let totalSkipped = 0;

  const STALE_HOURS = 24;
  const staleTime = Date.now() - STALE_HOURS * 60 * 60 * 1000;

  // --------------------------------------
  // STEP 1: Crawl category listings
  // --------------------------------------
  await Promise.all(
    categories.map((category) =>
      categoryLimit(async () => {
        const listings = await fetchProductListings(category);

        logger.info(`✔ ${category.slug} → ${listings.length} products`);

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

  const productsToScrape = [...productMap.values()];

  logger.info(`🆕 Products To Scrape : ${productsToScrape.length}`);
  logger.info(`⏭️ Products Skipped   : ${totalSkipped}`);

  // Nothing new to scrape
  if (productsToScrape.length === 0) {
    logger.info("✅ Everything is already up-to-date.");
    logger.info("====================================");
    logger.info("✅ PRODUCT SYNC COMPLETE");
    logger.info(`Categories       : ${categories.length}`);
    logger.info(`Listings Scanned : ${totalListings}`);
    logger.info(`Products Scraped : 0`);
    logger.info(`Products Skipped : ${totalSkipped}`);
    logger.info(`Inserted         : 0`);
    logger.info(`Updated          : 0`);
    logger.info("====================================");
    return;
  }

  // --------------------------------------
  // STEP 2: Fetch details + Save batches
  // --------------------------------------
  let inserted = 0;
  let updated = 0;
  let processed = 0;

  for (
    let i = 0;
    i < productsToScrape.length;
    i += scraperConfig.batchSize
  ) {
    const chunk = productsToScrape.slice(
      i,
      i + scraperConfig.batchSize
    );

    const detailedChunk = (
      await Promise.all(
        chunk.map((product) =>
          productLimit(async () => {
            try {
              const details = await fetchProductDetails(product);

              logger.info(
                `✔ ${details.slug} ₹${details.sellingPrice ?? "-"}`
              );

              return details;
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

    logger.info(
      `💾 Batch Saved (${processed}/${productsToScrape.length}) | +${result.upsertedCount} inserted | ${result.modifiedCount} updated`
    );
  }

  // --------------------------------------
  // STEP 3: Summary
  // --------------------------------------
  logger.info("====================================");
  logger.info("✅ PRODUCT SYNC COMPLETE");
  logger.info(`Categories       : ${categories.length}`);
  logger.info(`Listings Scanned : ${totalListings}`);
  logger.info(`Products Scraped : ${processed}`);
  logger.info(`Products Skipped : ${totalSkipped}`);
  logger.info(`Inserted         : ${inserted}`);
  logger.info(`Updated          : ${updated}`);
  logger.info("====================================");
}

module.exports = {
  syncListings,
};