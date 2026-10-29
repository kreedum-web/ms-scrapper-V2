const Product = require("../models/product.model");
const logger = require("../utils/logger");

/**
 * Save one batch of products using MongoDB bulkWrite.
 *
 * Products are expected to be normalized already (see scraper.service.js).
 * Failed scrapes ({ failed: true }) only record the error on an existing
 * product: they never create a product and never overwrite good data, and
 * they keep their old lastScrapedAt so the next run retries them.
 */
async function saveProductBatch(products) {
  if (!products.length) {
    return {
      upsertedCount: 0,
      modifiedCount: 0,
      matchedCount: 0,
      reactivated: 0,
    };
  }

  const scraped = products.filter((product) => !product.failed && !product.rejected);
  const failed = products.filter((product) => product.failed);
  // Rejected by a quality rule (e.g. no images): never inserted; an existing
  // copy is taken off the site by marking it inactive.
  const rejected = products.filter((product) => product.rejected);

  // Find products that were inactive before this sync
  const reactivated = await Product.countDocuments({
    supplier: "metrosports",
    status: "inactive",
    url: { $in: scraped.map((product) => product.url) },
  });

  const operations = [
    ...scraped.map((product) => ({
      updateOne: {
        filter: { url: product.url },
        update: {
          $set: {
            ...product,

            // Reactivate product if it exists again
            status: "active",
            removedAt: null,
            lastError: null,

            lastScrapedAt: new Date(),
          },
        },
        upsert: true,
      },
    })),

    ...failed.map((product) => ({
      updateOne: {
        filter: { url: product.url },
        update: { $set: { lastError: product.lastError } },
      },
    })),

    ...rejected.map((product) => ({
      updateOne: {
        filter: { url: product.url },
        update: {
          $set: {
            status: "inactive",
            removedAt: new Date(),
            lastError: product.lastError,
            lastScrapedAt: new Date(),
          },
        },
      },
    })),
  ];

  // ordered:false so one bad document doesn't stop the rest of the batch.
  const result = await Product.bulkWrite(operations, { ordered: false });

  logger.info(
    `Batch Saved: ${result.upsertedCount} new | ${result.modifiedCount} updated | ${failed.length} failed | ${rejected.length} rejected`
  );

  return {
    upsertedCount: result.upsertedCount,
    modifiedCount: result.modifiedCount,
    matchedCount: result.matchedCount,
    reactivated,
  };
}

/**
 * Wrapper used by the current scraper.
 */
async function saveProducts(products) {
  return saveProductBatch(products);
}

/**
 * Load all existing products into a Map(url -> product)
 * Used for stale/new product detection.
 *
 * (Previously the projection was passed as the filter, so this always
 * returned an empty map and every product was re-scraped on every run.)
 */
async function getExistingProducts(supplier = "metrosports") {
  const products = await Product.find(
    { supplier },
    {
      url: 1,
      lastScrapedAt: 1,
      status: 1,
      removedAt: 1,
      categorySlug: 1,
      normalizerVersion: 1,
    }
  ).lean();

  return new Map(products.map((product) => [product.url, product]));
}

/**
 * Products whose URL Metro Sports renamed: move the stored product to its new
 * URL (keeping the old one in `previousUrls`) instead of creating a duplicate.
 *
 * Run after the listing crawl and BEFORE scraping product pages, so the
 * scrape updates the existing document.
 *
 * @param {Map<string, object>} existingProducts  from getExistingProducts(); updated in place
 * @param {Set<string>} liveUrls                   every product URL in the listing crawl
 * @param {(url: string) => Promise<string|null>} resolveRedirect
 * @param {(url: string) => string} canonical      URL formatter used for live URLs
 * @returns {Promise<Array<{from: string, to: string}>>}
 */
async function relinkMovedProducts(existingProducts, liveUrls, resolveRedirect, canonical, concurrency = 5) {
  const missing = [...existingProducts.values()].filter(
    (product) => product.status !== "inactive" && !liveUrls.has(product.url)
  );

  const moves = [];
  for (let i = 0; i < missing.length; i += concurrency) {
    const results = await Promise.all(
      missing.slice(i, i + concurrency).map(async (product) => {
        const target = await resolveRedirect(product.url);
        const to = target && canonical(target);
        // Only relink to a live product that isn't already stored under its own URL.
        if (to && to !== product.url && liveUrls.has(to) && !existingProducts.has(to)) {
          return { from: product.url, to };
        }
        return null;
      })
    );
    moves.push(...results.filter(Boolean));
  }

  if (!moves.length) return moves;

  await Product.bulkWrite(
    moves.map(({ from, to }) => ({
      updateOne: {
        filter: { url: from },
        update: { $set: { url: to }, $addToSet: { previousUrls: from } },
      },
    })),
    { ordered: false }
  );

  for (const { from, to } of moves) {
    const product = existingProducts.get(from);
    existingProducts.delete(from);
    existingProducts.set(to, { ...product, url: to });
  }

  logger.info(`🔀 Relinked ${moves.length} products whose Metro URL changed`);
  return moves;
}

/**
 * Mark products inactive when they no longer appear in any category listing.
 *
 * @param {Iterable<string>} liveUrls  EVERY product URL seen in this crawl,
 *   including products skipped because they were scraped recently.
 */
async function markRemovedProducts(liveUrls, supplier = "metrosports") {
  const live = [...liveUrls];

  // Safety net: if the listing crawl came back mostly empty (site down,
  // layout change), don't deactivate the whole catalogue.
  const activeCount = await Product.countDocuments({ supplier, status: "active" });

  if (activeCount > 0 && live.length < activeCount * 0.5) {
    logger.warn(
      `⚠️ Only ${live.length} live listings vs ${activeCount} active products — skipping removal check`
    );
    return 0;
  }

  const result = await Product.updateMany(
    {
      supplier,
      status: "active",
      url: {
        $nin: live,
      },
    },
    {
      $set: {
        status: "inactive",
        removedAt: new Date(),
      },
    }
  );

  return result.modifiedCount;
}

module.exports = {
  saveProductBatch,
  saveProducts,
  getExistingProducts,
  relinkMovedProducts,
  markRemovedProducts,
};
