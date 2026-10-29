/**
 * Product options ("variations" in WooCommerce) — e.g. a dumbbell sold in
 * 0.5 kg … 6 kg, each weight with its own price.
 *
 * Metro Sports runs WooCommerce. A product with options has a
 * <form class="variations_form"> whose `data-product_variations` attribute
 * holds every combination as JSON (price, MRP, SKU, stock, photo), and a
 * <table class="variations"> with one <select> per option giving the
 * option's name ("Weight") and the readable label of each value ("0.5KG").
 *
 * With many combinations WooCommerce leaves `data-product_variations="false"`
 * and loads them on demand; then we read them from WooCommerce's public
 * Store API instead (see fetchVariationsFromStoreApi).
 *
 * Returns the raw data; src/normalize/normalizeVariants.js turns it into the
 * shape the website uses.
 */
const request = require("../utils/request");

/**
 * @param {import("cheerio").CheerioAPI} $  product page
 * @returns {{ productId: string, options: Array, variations: Array|null } | null}
 *   null when the product has no options. `variations` is null when the page
 *   didn't include them (too many); fetch them with fetchVariationsFromStoreApi.
 */
function parseVariations($) {
  const form = $("form.variations_form").first();
  if (!form.length) return null;

  const productId = String(form.attr("data-product_id") || "");

  // Option names and value labels, in the order Metro shows them.
  const options = [];
  form.find("table.variations select").each((_, select) => {
    const $select = $(select);
    const key = $select.attr("data-attribute_name") || $select.attr("name") || "";
    if (!key) return;

    const id = $select.attr("id");
    const name =
      (id && form.find(`label[for="${id}"]`).first().text().trim()) ||
      key.replace(/^attribute_(pa_)?/, "").replace(/[-_]+/g, " ");

    const values = [];
    $select.find("option").each((__, option) => {
      const value = $(option).attr("value");
      if (value) values.push({ value, label: $(option).text().trim() || value });
    });

    options.push({ key, name, values });
  });

  if (!options.length) return null;

  const raw = form.attr("data-product_variations");
  let variations = null;

  if (raw && raw !== "false") {
    try {
      // cheerio has already decoded the HTML entities in the attribute.
      variations = JSON.parse(raw).map(fromWooVariation);
    } catch {
      variations = null;
    }
  }

  return { productId, options, variations };
}

/** One entry of data-product_variations -> our raw variation. */
function fromWooVariation(variation) {
  return {
    id: String(variation.variation_id),
    attributes: variation.attributes || {},
    sku: variation.sku || "",
    sellingPrice: Number(variation.display_price) || 0,
    mrp: Number(variation.display_regular_price) || 0,
    inStock: variation.is_in_stock !== false && variation.is_purchasable !== false,
    image: variation.image?.full_src || variation.image?.url || "",
  };
}

/**
 * Fallback for products whose page doesn't embed the variations.
 * WooCommerce Store API (public, read-only):
 *   /wp-json/wc/store/v1/products/<id>            -> variation ids + attributes
 *   /wp-json/wc/store/v1/products/<variation id>  -> price, stock, image
 * Prices there are in minor units (paise).
 */
async function fetchVariationsFromStoreApi(productUrl, productId, options) {
  const origin = new URL(productUrl).origin;
  const api = (id) => `${origin}/wp-json/wc/store/v1/products/${id}`;
  // axios already parses JSON responses
  const get = async (id) => {
    const data = await request(api(id));
    return typeof data === "string" ? JSON.parse(data) : data;
  };

  const parent = await get(productId);
  const keyByName = new Map(options.map((o) => [o.name.toLowerCase(), o.key]));
  const valueByLabel = new Map(
    options.flatMap((o) => o.values.map((v) => [`${o.key}|${v.label.toLowerCase()}`, v.value]))
  );

  const variations = [];
  for (const entry of parent.variations || []) {
    const detail = await get(entry.id);
    const minor = 10 ** (detail.prices?.currency_minor_unit ?? 2);

    const attributes = {};
    for (const attribute of entry.attributes || []) {
      const key = keyByName.get(String(attribute.name).toLowerCase());
      if (!key) continue;
      const value = String(attribute.value || "");
      attributes[key] = valueByLabel.get(`${key}|${value.toLowerCase()}`) || value;
    }

    variations.push({
      id: String(entry.id),
      attributes,
      sku: detail.sku || "",
      sellingPrice: Number(detail.prices?.price || 0) / minor,
      mrp: Number(detail.prices?.regular_price || 0) / minor,
      inStock: detail.is_in_stock !== false && detail.is_purchasable !== false,
      image: detail.images?.[0]?.src || "",
    });
  }

  return variations;
}

module.exports = { parseVariations, fetchVariationsFromStoreApi, fromWooVariation };
