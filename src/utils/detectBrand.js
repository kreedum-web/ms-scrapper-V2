const { brands, skuPrefixes, defaultBrand } = require("../config/brandDictionary");

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Pre-compile one matcher per brand.
const matchers = brands.map((brand) => {
  const alternatives = brand.aliases.map(escapeRegex).join("|");

  return {
    name: brand.name,
    exact: new RegExp(`^\\s*(?:${alternatives})\\s*$`, "i"),
    atStart: new RegExp(`^\\s*(?:${alternatives})\\b`, "i"),
    anywhere: brand.anywhere ? new RegExp(`\\b(?:${alternatives})\\b`, "i") : null,
  };
});

/** Map any spelling ("EVERISE FITNESS", "PowerMax Fitness") to its canonical name. */
function canonicalBrand(raw = "") {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  const match = matchers.find((m) => m.exact.test(text) || m.atStart.test(text));
  return match ? match.name : text;
}

/** Find a brand mentioned in a product name. */
function brandFromName(name = "") {
  const atStart = matchers.find((m) => m.atStart.test(name));
  if (atStart) return atStart.name;

  const anywhere = matchers.find((m) => m.anywhere && m.anywhere.test(name));
  return anywhere ? anywhere.name : "";
}

function brandFromSku(sku = "") {
  const rule = skuPrefixes.find((r) => r.pattern.test(sku || ""));
  return rule ? rule.brand : "";
}

/**
 * Resolve a product's brand, most reliable source first.
 * Returns { brand, source } where source says which rule matched.
 */
function detectBrand({ brand, specifications = {}, name = "", sku = "" } = {}) {
  const specBrand = specifications.Brand || specifications.brand;

  const candidates = [
    ["spec-table", specBrand],
    ["scraped", brand],
    ["name", brandFromName(name)],
    ["sku", brandFromSku(sku)],
    ["default", defaultBrand],
  ];

  for (const [source, value] of candidates) {
    const resolved = canonicalBrand(value);
    if (resolved && resolved.toLowerCase() !== "unknown") {
      return { brand: resolved, source };
    }
  }

  return { brand: "", source: "none" };
}

module.exports = detectBrand;
module.exports.canonicalBrand = canonicalBrand;
module.exports.brandFromName = brandFromName;
