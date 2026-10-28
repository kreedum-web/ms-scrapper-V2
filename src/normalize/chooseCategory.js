/**
 * Pick ONE category for a product that Metro Sports lists in several.
 *
 * The listing crawl runs categories in parallel, so "first category seen"
 * changes from run to run and products jump between categories on the
 * website. This picks deterministically:
 *
 *   1. keep the product's current category if it is still listed there
 *      (stops products moving around between syncs)
 *   2. otherwise prefer the most specific category the backend knows
 *   3. tie-break alphabetically
 */
const backendCategories = new Set(require("../config/backendCategories"));

// Catch-all buckets: only used when nothing more specific exists.
const GENERIC = new Set(["miscellaneous", "unique-items"]);

function specificity(slug) {
  let score = 0;
  if (backendCategories.has(slug)) score += 100;
  if (/^(commercial|semi-commercial|domestic)-/.test(slug)) score += 10;
  if (GENERIC.has(slug)) score -= 50;
  return score;
}

function chooseCategory(categorySlugs = [], currentSlug = "") {
  const unique = [...new Set(categorySlugs.filter(Boolean))];
  if (!unique.length) return currentSlug || "";

  if (currentSlug && unique.includes(currentSlug) && backendCategories.has(currentSlug)) {
    return currentSlug;
  }

  return unique.sort((a, b) => specificity(b) - specificity(a) || a.localeCompare(b))[0];
}

module.exports = chooseCategory;
module.exports.isBackendCategory = (slug) => backendCategories.has(slug);
