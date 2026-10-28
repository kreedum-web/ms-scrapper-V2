/**
 * Read Metro Sports' category tree from the site's main menu.
 *
 * Result: a flat list of nodes, parents before children, e.g.
 *   Cardio (level 1, department)
 *     Treadmills (level 2)            slug "treadmill"
 *       Commercial Treadmill (level 3) slug "commercial-treadmill"
 *   Accessories (level 1)
 *     Other Accessories (level 2, group: menu heading without its own page)
 *       Jacket (level 3)
 *
 * Slugs are the ones Metro Sports uses in its URLs, so they match the
 * `posted_in` category on each product page:
 *   /product-category/weights-bars/dumbbells/  -> "dumbbells"
 *   /our-products/cardio/                      -> "cardio"
 *   /sports/                                   -> "sports"
 *
 * Top-level menu items that aren't product departments (Gym Packages,
 * Catalogues, Store Locations) are skipped.
 */
const cheerio = require("cheerio");
const slugify = require("slugify");

const request = require("../utils/request");
const logger = require("../utils/logger");
const { cleanLine, fixAllCaps } = require("../normalize/text");

const SUPPLIER = "metrosports";

function slugFromUrl(url) {
  const path = new URL(url).pathname.replace(/^\/|\/$/g, "");
  const categoryPath = path.replace(/^product-category\//, "");
  return {
    slug: categoryPath.split("/").pop(),
    sourceSlug: categoryPath,
  };
}

function isCategoryUrl(url) {
  return /\/product-category\//.test(url);
}

function isDepartmentUrl(url) {
  return /\/our-products\/[^/]+\/?$/.test(url) || /^https?:\/\/[^/]+\/sports\/?$/.test(url);
}

/** Pick the main menu: the top-level <ul> with the most category links. */
function findMainMenu($) {
  let best = null;
  let bestCount = 0;

  $("ul").each((_, ul) => {
    if ($(ul).parents("ul").length) return;
    const count = $(ul).find('a[href*="/product-category/"]').length;
    if (count > bestCount) {
      best = ul;
      bestCount = count;
    }
  });

  return best ? $(best) : null;
}

/**
 * Pure parser (no network) so it can be tested against saved HTML.
 * @returns {object[]} nodes in menu order, parents before children
 */
function parseMenuTree(html, baseUrl) {
  const $ = cheerio.load(html);
  const menu = findMainMenu($);
  if (!menu) return [];

  const nodes = [];
  const seen = new Set();

  const walk = (ul, parent) => {
    ul.children("li").each((index, li) => {
      const anchor = $(li).children("a").first();
      const sourceName = cleanLine(anchor.text());
      const href = anchor.attr("href") || "";
      const hasChildren = $(li).children("ul").length > 0;

      if (!sourceName) return;

      let url = "";
      try {
        url = href && !href.startsWith("#") ? new URL(href, baseUrl).href : "";
      } catch {
        url = "";
      }

      // Top level: keep product departments only.
      if (!parent) {
        const hasCategories = $(li).find('a[href*="/product-category/"]').length > 0;
        if (!hasCategories && !(url && isDepartmentUrl(url))) return;
      }

      let slug;
      let sourceSlug;
      let kind;

      if (url && (isCategoryUrl(url) || isDepartmentUrl(url))) {
        ({ slug, sourceSlug } = slugFromUrl(url));
        kind = parent ? "category" : "department";
      } else {
        // Menu heading with no page of its own ("OTHER ACCESSORIES").
        slug = slugify(sourceName, { lower: true, strict: true });
        sourceSlug = slug;
        kind = "group";
        url = `${baseUrl.replace(/\/$/, "")}/#menu-group-${slug}`;
      }

      if (seen.has(slug)) {
        logger.warn(`⚠️ Menu lists "${slug}" twice; keeping the first position`);
        return;
      }
      seen.add(slug);

      const node = {
        supplier: SUPPLIER,
        name: fixAllCaps(sourceName),
        sourceName,
        slug,
        sourceSlug,
        url,
        kind,
        level: parent ? parent.level + 1 : 1,
        parentSlug: parent ? parent.slug : null,
        rootSlug: parent ? parent.rootSlug : slug,
        path: parent ? [...parent.path, slug] : [slug],
        displayOrder: index,
        isActive: true,
      };

      nodes.push(node);

      if (hasChildren) {
        walk($(li).children("ul").first(), node);
      }
    });
  };

  walk(menu, null);
  return nodes;
}

async function crawlMenu(baseUrl = process.env.BASE_URL || "https://metrosports.co.in/") {
  logger.info("📂 Crawling Metro Sports menu");

  const html = await request(baseUrl);
  const nodes = parseMenuTree(html, baseUrl);

  const byLevel = nodes.reduce((acc, n) => ({ ...acc, [n.level]: (acc[n.level] || 0) + 1 }), {});
  logger.info(
    `✅ Menu tree: ${nodes.length} nodes (` +
      Object.entries(byLevel).map(([l, c]) => `level ${l}: ${c}`).join(", ") +
      ")"
  );

  if (!nodes.length) {
    throw new Error("Menu tree came back empty — the site layout may have changed.");
  }

  return nodes;
}

module.exports = crawlMenu;
module.exports.parseMenuTree = parseMenuTree;
