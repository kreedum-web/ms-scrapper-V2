/**
 * Decide which node of Metro's category tree a product belongs to.
 *
 * Sources, most reliable first:
 *   1. `postedIn`  — the category printed on the product page itself
 *   2. listing pages the product appeared on (a parent page like
 *      "Treadmills" also lists every commercial/domestic treadmill)
 *   3. the category it already has in MongoDB
 *
 * Within a source the DEEPEST node in the tree wins ("commercial-treadmill"
 * beats "treadmill"). Ties keep the current category, then go alphabetical,
 * so a product never jumps between categories from run to run.
 */

/** "weights-bars/dumbbells" -> "dumbbells" (Metro nests some slugs in the URL). */
function leafSlug(slug = "") {
  return String(slug || "").replace(/\/+$/, "").split("/").pop();
}

/**
 * @param {object}   sources
 * @param {string[]} sources.postedIn       categories on the product page
 * @param {string[]} sources.listings       category pages the product was listed on
 * @param {string}   sources.current        category already stored
 * @param {Map<string, object>} tree        slug -> category node ({ level, path, ... })
 * @returns {string} chosen slug ("" when nothing is known)
 */
function chooseCategory({ postedIn = [], listings = [], current = "" } = {}, tree) {
  const currentLeaf = leafSlug(current);

  const pick = (candidates) => {
    const known = [...new Set(candidates.map(leafSlug).filter(Boolean))].filter((slug) =>
      tree ? tree.has(slug) : true
    );
    if (!known.length) return "";

    return known.sort((a, b) => {
      const depth = (s) => (tree?.get(s)?.level || 0);
      return (
        depth(b) - depth(a) ||
        (b === currentLeaf) - (a === currentLeaf) ||
        a.localeCompare(b)
      );
    })[0];
  };

  return (
    pick(postedIn) ||
    pick(listings) ||
    pick([currentLeaf]) ||
    // Unknown to the tree: keep what we have so the issue shows up in dataIssues.
    leafSlug(postedIn[0]) ||
    leafSlug(listings[0]) ||
    currentLeaf
  );
}

module.exports = chooseCategory;
module.exports.leafSlug = leafSlug;
