const cheerio = require("cheerio");
const request = require("../utils/request");

function extractProductSlug(productUrl) {
  try {
    const url = new URL(productUrl);

    const parts = url.pathname
      .split("/")
      .filter(Boolean);

    const productIndex = parts.indexOf("product");

    if (productIndex !== -1 && parts[productIndex + 1]) {
      return parts[productIndex + 1];
    }

    return parts.at(-1) || "";
  } catch {
    return "";
  }
}

async function fetchProductListings(category) {
  let currentUrl = category.url;
  let page = 1;

  const products = [];
  const seenUrls = new Set();

  while (currentUrl) {
    console.log(`📄 Crawling Page ${page}: ${currentUrl}`);

    const html = await request(currentUrl);
    const $ = cheerio.load(html);

    $("li.product").each((_, element) => {
      const link = $(element)
        .find("a.woocommerce-LoopProduct-link")
        .first()
        .attr("href");

      const name = $(element)
        .find("h2.woocommerce-loop-product__title")
        .first()
        .text()
        .trim();

      if (!link || !name) {
        return;
      }

      let productUrl;

      try {
        productUrl = new URL(link, currentUrl).href;
      } catch {
        return;
      }

      productUrl = productUrl.split("#")[0];

      if (seenUrls.has(productUrl)) {
        return;
      }

      seenUrls.add(productUrl);

      const slug = extractProductSlug(productUrl);

      if (!slug) {
        return;
      }

      products.push({
        supplier: category.supplier,
        categorySlug: category.slug,
        categoryName: category.name,
        name,
        slug,
        url: productUrl,
      });
    });

    const nextPage = $("a.next.page-numbers")
      .first()
      .attr("href");

    if (!nextPage) {
      break;
    }

    const normalizedNextPage = new URL(
      nextPage,
      currentUrl
    ).href;

    if (normalizedNextPage === currentUrl) {
      break;
    }

    currentUrl = normalizedNextPage;
    page += 1;
  }

  return products;
}

module.exports = {
  fetchProductListings,
};