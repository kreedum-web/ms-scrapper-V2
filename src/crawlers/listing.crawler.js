const cheerio = require("cheerio");
const pLimit = require("p-limit").default;

const request = require("../utils/request");
console.log("request type:", typeof request);
const scraperConfig = require("../config/scraper.config");
const logger = require("../utils/logger");

const pageLimit = pLimit(scraperConfig.pageConcurrency);

function extractProductSlug(productUrl) {
  try {
    const url = new URL(productUrl);

    const parts = url.pathname.split("/").filter(Boolean);

    const productIndex = parts.indexOf("product");

    if (productIndex !== -1 && parts[productIndex + 1]) {
      return parts[productIndex + 1];
    }

    return parts.at(-1) || "";
  } catch {
    return "";
  }
}

async function getPaginationInfo(categoryUrl) {
  const html = await request(categoryUrl);
  const $ = cheerio.load(html);

  let totalPages = 1;

  // Read page numbers ONLY from pagination URLs.
  $("nav.woocommerce-pagination a.page-numbers").each((_, el) => {
    const href = $(el).attr("href");

    if (!href) return;

    const match = href.match(/\/page\/(\d+)\/?/);

    if (match) {
      const pageNumber = Number(match[1]);

      if (pageNumber > totalPages) {
        totalPages = pageNumber;
      }
    }
  });

  // Safety guard
  if (totalPages > 50) {
    logger.warn(
      `⚠️ Suspicious pagination detected (${totalPages}) for ${categoryUrl}`
    );
  }

  return {
    html,
    totalPages,
  };
}

async function scrapeListingPage(category, pageUrl) {
  const html = await request(pageUrl);
  const $ = cheerio.load(html);

  const products = [];

  $("li.product").each((_, element) => {
    const link = $(element)
      .find("a.woocommerce-LoopProduct-link")
      .attr("href");

    const name = $(element)
      .find("h2.woocommerce-loop-product__title")
      .text()
      .trim();

    if (!link || !name) return;

    const url = new URL(link, pageUrl).href.split("#")[0];
    const slug = extractProductSlug(url);

    products.push({
      supplier: category.supplier,
      categorySlug: category.slug,
      categoryName: category.name,
      name,
      slug,
      url,
    });
  });

  return products;
}

async function fetchProductListings(category) {
  // logger.info(`📄 ${category.slug} | Discovering pages`);


  const { html, totalPages } = await getPaginationInfo(category.url);
  logger.info(`📁 ${category.slug.padEnd(28)} | ${totalPages} pages`);


  // logger.info(`📚 ${category.slug} has ${totalPages} pages`);

  const firstPageProducts = [];
  const firstPageDom = cheerio.load(html);

  firstPageDom("li.product").each((_, element) => {
    const link = firstPageDom(element)
      .find("a.woocommerce-LoopProduct-link")
      .attr("href");

    const name = firstPageDom(element)
      .find("h2.woocommerce-loop-product__title")
      .text()
      .trim();

    if (!link || !name) return;

    const url = new URL(link, category.url).href.split("#")[0];
    const slug = extractProductSlug(url);

    firstPageProducts.push({
      supplier: category.supplier,
      categorySlug: category.slug,
      categoryName: category.name,
      name,
      slug,
      url,
    });
  });

  const remainingPages = [];

  for (let page = 2; page <= totalPages; page++) {
    remainingPages.push(
      `${category.url.replace(/\/$/, "")}/page/${page}/?`
    );
  }

  const pageResults = await Promise.all(
   remainingPages.map((pageUrl) =>
  pageLimit(async () => {
    try {
      return await scrapeListingPage(category, pageUrl);
        } catch (error) {
          logger.error(`❌ Failed page: ${pageUrl}`);
          return [];
        }
      })
    )
  );

  const seen = new Set();
  const allProducts = [];

  [...firstPageProducts, ...pageResults.flat()].forEach((product) => {
    if (seen.has(product.url)) return;

    seen.add(product.url);
    allProducts.push(product);
  });

  if (allProducts.length === 0) {
  logger.warn(`⚠️ ${category.slug} returned 0 products.`);
}
logger.info(
  `✔ ${category.slug.padEnd(28)} | ${allProducts.length} products`
);
  return allProducts;
}

module.exports = {
  fetchProductListings,
  getPaginationInfo, // <-- export for testing
};