const pLimit = require("p-limit").default;
const scraperConfig = require("../config/scraper.config");


const logger = require("../utils/logger");
const { getCategories } = require("./category.service");
const { fetchProductListings } = require("../crawlers/listing.crawler");
const { fetchProductDetails } = require("../crawlers/product.crawler");
const normalizeProduct = require("../normalize/normalizeProduct");
const { canonicalUrl } = normalizeProduct;
const {
  saveProductBatch,
  getExistingProducts,
  markRemovedProducts,
} = require("./product.service");

const {
  startSyncRun,
  completeSyncRun,
  failSyncRun,
  updateSyncProgress,
  getRunningSync
} = require("./sync.service");



// Product detail workers
const productLimit = pLimit(scraperConfig.concurrency);

// Category listing workers
const categoryLimit = pLimit(scraperConfig.categoryConcurrency);

async function syncListings() {
  const startedAt = Date.now();

  logger.info("🚀 Running Full Product Sync");

  let syncRun = await getRunningSync("metrosports");

if (syncRun) {
  logger.warn(`♻️ Resuming Sync: ${syncRun._id}`);
} else {
  syncRun = await startSyncRun("metrosports");
  logger.info(`📝 New Sync Run: ${syncRun._id}`);
}

    let categories = [];
  let existingProducts = new Map();

  let totalListings = 0;
  let totalSkipped = 0;

 let inserted = syncRun.inserted || 0;
let updated = syncRun.updated || 0;
let processed = syncRun.productsScraped || 0;
let removed =0;
let reactivated=0;
let failedProducts = 0;
  let completedCategories = 0;

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

    await   updateSyncProgress(syncRun._id, {
  totalCategories: categories.length,
});

    logger.info(`📂 Loaded ${categories.length} categories from MongoDB`);

const productMap = new Map();

// url -> every category the product is listed in. A product can sit in
// several categories; normalizeProduct() picks one deterministically.
const productCategories = new Map();

// Every product URL seen in this crawl (scraped or skipped). Used to detect
// products Metro Sports has removed.
const liveUrls = new Set();

const categoryNames = Object.fromEntries(
  categories.map((category) => [category.slug, category.name])
);

logger.info(`📚 Crawling Categories (${categories.length})`);
logger.info("────────────────────────────────────");

await Promise.all(
  categories.map((category) =>
    categoryLimit(async () => {
      const listings = await fetchProductListings(category);


      completedCategories++;
      totalListings += listings.length;


      await   updateSyncProgress(syncRun._id, {
  completedCategories,
  listingsFound: totalListings,
  lastCategory: category.slug,
});

      for (const listing of listings) {
        // Same URL format as stored in MongoDB (https, trailing slash, no query).
        const product = { ...listing, url: canonicalUrl(listing.url) || listing.url };

        liveUrls.add(product.url);

        if (!productCategories.has(product.url)) {
          productCategories.set(product.url, new Set());
        }
        productCategories.get(product.url).add(product.categorySlug);

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

// const allProducts = [...productMap.values()];

const allProducts = [...productMap.values()].sort((a, b) =>
  a.url.localeCompare(b.url)
);

const duplicateListings = totalListings - allProducts.length;

const resumeIndex = syncRun.productsScraped || 0;

const productsToScrape = allProducts.slice(resumeIndex);

if (resumeIndex > 0) {
  logger.warn(
    `♻️ Resuming from product ${resumeIndex}/${allProducts.length}`
  );
    logger.info(
    `♻️ Remaining Products : ${productsToScrape.length}`
  );

}
await   updateSyncProgress(syncRun._id, {
  totalProducts: allProducts.length,
});

logger.info(`🆕 Products To Scrape : ${productsToScrape.length}`);
logger.info(`⏭️ Products Skipped   : ${totalSkipped}`);

if (productsToScrape.length === 0) {
  logger.info("✅ Everything is already up-to-date.");
} else {

 const totalBatches = Math.ceil(
  allProducts.length / scraperConfig.batchSize
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
  Math.floor((resumeIndex + i) / scraperConfig.batchSize) + 1;

    logger.info(
      `📦 Batch ${batchNumber}/${totalBatches} • Scraping ${chunk.length} products...`
    );

    const detailedChunk = (
      await Promise.all(
        chunk.map((product) =>
          productLimit(async () => {
            try {
              const detailed = await fetchProductDetails(product);

              const categorySlugs = [
                ...(productCategories.get(product.url) || [product.categorySlug]),
              ].sort();

              const normalized = normalizeProduct(detailed, {
                categorySlugs,
                currentCategorySlug: existingProducts.get(product.url)?.categorySlug,
                categoryNames,
              });

              const errors = normalized.dataIssues.filter((issue) =>
                issue.startsWith("error:")
              );

              if (errors.length) {
                logger.warn(`⚠️ ${product.slug}: ${errors.join(", ")}`);
              }

              return {
                ...detailed,
                ...normalized,
                categorySlugs,
              };
            } catch (error) {
              logger.error(`❌ Failed: ${product.slug}`);
               failedProducts++;
              return {
                url: product.url,
                failed: true,
                lastError: error.message,
              };
            }
          })
        )
      )
    ).filter(Boolean);

    if (!detailedChunk.length) continue;

    const result = await saveProductBatch(detailedChunk);

    reactivated += result.reactivated;
    inserted += result.upsertedCount;
    updated += result.modifiedCount;
    processed += detailedChunk.length;



    const progressPercent = Math.round(
(processed / allProducts.length) * 100);

await   updateSyncProgress(syncRun._id, {
  currentBatch: batchNumber,
  totalBatches,
  productsScraped: processed,
  inserted,
  updated,
  progressPercent,
  lastProductSlug:
    detailedChunk[detailedChunk.length - 1]?.slug,
});

   logger.info(
  `💾 Batch ${batchNumber}/${totalBatches} • ${progressPercent}% • ${processed}/${allProducts.length} products`
);
  }
}

logger.info("🧹 Checking for removed products...");

 removed = await markRemovedProducts(
  liveUrls,
  "metrosports"
);

logger.info(`🗑 Removed Products : ${removed}`);

const successRate =
  allProducts.length === 0
    ? 100
    : Number(
        (
          ((processed - failedProducts) / allProducts.length) *
          100
        ).toFixed(2)
      );

let healthStatus = "healthy";

if (failedProducts > 20) {
  healthStatus = "warning";
}

if (successRate < 95) {
  healthStatus = "failed";
}

 await completeSyncRun(syncRun._id, {
  startedAt,

  categoriesScanned: categories.length,
  listingsFound: totalListings,

  productsScraped: processed,
  productsSkipped: totalSkipped,

  inserted,
  updated,
  failed: failedProducts,
  removed,
  reactivated,

  duplicateListings,
  successRate,
  healthStatus,
});

    // --------------------------------------
    // STEP 3: Summary
    // --------------------------------------
    const duration = Math.round((Date.now() - startedAt) / 1000);

   logger.info("====================================");
logger.info("✅ PRODUCT SYNC COMPLETE");
logger.info("====================================");

logger.info(`Supplier         : MetroSports`);

logger.info(
  `Duration         : ${Math.floor(duration / 60)}m ${duration % 60}s`
);

logger.info("------------------------------------");

logger.info(`Categories       : ${categories.length}`);
logger.info(`Listings Found   : ${totalListings}`);
logger.info(`Unique Products  : ${allProducts.length}`);
logger.info(`Duplicates       : ${duplicateListings}`);

logger.info("------------------------------------");

logger.info(`Products Scraped : ${processed}`);
logger.info(`Products Skipped : ${totalSkipped}`);

logger.info(`Inserted         : ${inserted}`);
logger.info(`Updated          : ${updated}`);
logger.info(`Removed          : ${removed}`);
logger.info(`Reactivated      : ${reactivated}`);
logger.info(`Failed           : ${failedProducts}`);

logger.info("------------------------------------");

logger.info(`Success Rate     : ${successRate}%`);
logger.info(`Health Status    : ${healthStatus.toUpperCase()}`);

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