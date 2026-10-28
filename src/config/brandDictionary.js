/**
 * Canonical brand names and the spellings that map to them.
 *
 * The backend (kreedum_backend) builds one Brand document per distinct
 * product.brand string, and hides any product whose brand is empty or
 * "Unknown". So every product must carry exactly one canonical spelling.
 *
 * `aliases` are matched case-insensitively against:
 *   1. the "Brand" row of the product's attribute/spec table
 *   2. the start of the product name (or anywhere, if `anywhere: true`)
 *
 * Add a brand here when Metro Sports starts listing a new one.
 */
module.exports = {
  brands: [
    { name: "Aerofit", aliases: ["aerofit", "aerofi"], anywhere: true },
    { name: "Assault Fitness", aliases: ["assault fitness"], anywhere: true },
    { name: "Everise Fitness", aliases: ["everise fitness", "everise"], anywhere: true },
    { name: "Xpeed", aliases: ["xpeed"], anywhere: true },
    { name: "Zorex Fitness", aliases: ["zorex fitness", "zorex"], anywhere: true },
    { name: "Powermax Fitness", aliases: ["powermax fitness", "power max fitness", "powermax"], anywhere: true },
    { name: "Concept2", aliases: ["concept2", "concept 2"], anywhere: true },
    { name: "USI", aliases: ["usi"] },
    { name: "Cosco", aliases: ["cosco"] },
    { name: "Nivia", aliases: ["nivia"] },
    { name: "Yonex", aliases: ["yonex"] },
    { name: "Li-Ning", aliases: ["li-ning", "li ning", "lining"] },
    { name: "Stag", aliases: ["stag"] },
    { name: "Butterfly", aliases: ["butterfly"] },
    { name: "Vector X", aliases: ["vector x"] },
  ],

  /**
   * SKU prefixes that identify a brand when neither the spec table nor the
   * name says it. Aerofit model codes are "AF-123", "AF 1036", "AF-167R TFT".
   * (Accessory codes like "AF-PB04" are deliberately not matched.)
   */
  skuPrefixes: [{ pattern: /^AF[\s-]?\d/i, brand: "Aerofit" }],

  /**
   * Brand used when nothing above matches. Leave empty to let the backend
   * mark the product "Unknown" (and hide it). Override with DEFAULT_BRAND.
   */
  defaultBrand: process.env.DEFAULT_BRAND || "",
};
