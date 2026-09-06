const cheerio = require("cheerio");
const request = require("../utils/request");

function normalizeCategory(url, name) {
  const pathname = new URL(url).pathname;

  const slug = pathname
    .replace("/product-category/", "")
    .replace(/^\/|\/$/g, "");

  return {
    supplier: process.env.SUPPLIER,
    name: name.trim(),
    slug,
    url: new URL(url).href,
    isActive: true,
  };
}

async function fetchCategories(baseUrl) {
  const html = await request(baseUrl);
  const $ = cheerio.load(html);

  const categoryMap = new Map();

  // Grab categories from all WooCommerce menus
  $("li.menu-item a, .product-categories a, nav a").each((_, element) => {
    const href = $(element).attr("href");
    const name = $(element).text().replace(/\s+/g, " ").trim();

    if (!href || !name) return;

    const url = new URL(href, baseUrl).href;

    if (!url.includes("/product-category/")) return;

    // Ignore pagination/filter URLs
    if (url.includes("?") || url.includes("#") || url.includes("/page/")) return;

    const slug = url
      .split("/product-category/")[1]
      ?.replace(/^\/|\/$/g, "");

    if (!slug) return;

    categoryMap.set(slug, normalizeCategory(url, name));
  });

  return [...categoryMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

module.exports = {
  fetchCategories,
};