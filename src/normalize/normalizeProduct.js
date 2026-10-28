/**
 * Turn one scraped Metro Sports product into the exact shape the
 * Kreedum backend migration (kreedum_backend/src/utils/transformProduct.js)
 * expects. Pure function: no network, no database.
 *
 * What the backend relies on, and how we guarantee it:
 *   url            upsert key        -> canonical https URL, trailing slash, no query/hash
 *   name + sku     website slug      -> clean name, real SKU or ""
 *   brand          brand pages       -> one canonical spelling, resolved from several sources
 *   categorySlug   category tree     -> one deterministic slug from backend's categoryMap
 *   mrp/sellingPrice  prices         -> positive numbers, mrp >= sellingPrice
 *   features       specs + highlights -> bullets, then "Key: Value" with canonical keys
 *   descriptionText  SEO description -> clean text, no supplier notes
 *   images/thumbnail                 -> absolute, de-duplicated
 *
 * Every product also gets `dataIssues`: "error:*" means the website will show
 * it wrong, "warn:*" means it is missing something, "fixed:*" records what the
 * normalizer changed.
 */
const detectBrand = require("../utils/detectBrand");
const chooseCategory = require("./chooseCategory");
const { lookup: keyLookup, dropKeys } = require("../config/featureKeys");
const { cleanLine, cleanBlock, fixAllCaps, stripInternalNotes, htmlToText } = require("./text");

const NORMALIZER_VERSION = 1;

// ---------------------------------------------------------------- URL

function canonicalUrl(raw = "") {
  try {
    const url = new URL(String(raw).trim());
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase();
    url.search = "";
    url.hash = "";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url.href;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------- NAME

/**
 * Metro Sports appends selling points to titles with " I " or " | ":
 *   "Air Hockey SDX I Multi-Colour Frame I Digital Scoring"
 * The first part is the name; the rest become feature bullets.
 * A single " I " only counts as a separator when both sides are at least
 * two words long, and a roman numeral after a dash ("Mini Snooker Table – I
 * ...") is kept.
 */
function splitNameTail(name) {
  const pipeParts = name.split(/\s+\|\s+/);
  let parts = [];

  const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;

  for (const part of pipeParts) {
    const separators = (part.match(/\s+I\s+/g) || []).length;
    let iParts = [part];

    if (separators >= 2) {
      iParts = part.split(/\s+I\s+/);
    } else if (separators === 1) {
      const [head, tail] = part.split(/\s+I\s+/);
      if (wordCount(head) >= 2 && wordCount(tail) >= 2 && !/[–—-]$/.test(head)) {
        iParts = [head, tail];
      }
    }

    parts.push(...iParts);
  }

  if (parts.length > 1 && /[–—-]$/.test(parts[0])) {
    parts[0] = `${parts[0]} I`;
  }

  parts = parts.map((p) => p.trim()).filter(Boolean);

  return { title: parts[0] || name, tail: parts.slice(1) };
}

/** Replace the brand mention at the start of a name with its canonical spelling. */
function canonicalizeBrandPrefix(name, brand) {
  if (!brand) return name;
  const { brandFromName } = detectBrand;
  if (brandFromName(name) !== brand) return name;

  const { brands } = require("../config/brandDictionary");
  const entry = brands.find((b) => b.name === brand);
  if (!entry) return name;

  for (const alias of [...entry.aliases].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`^${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(name)) return name.replace(re, brand);
  }
  return name;
}

// ---------------------------------------------------------------- SKU

function cleanSku(raw) {
  const sku = cleanLine(raw || "");
  if (/^(n\/?a|na|none|nil|null|-+|\.)$/i.test(sku)) return "";
  return sku;
}

// ---------------------------------------------------------------- PRICE

function toPrice(value) {
  if (value == null) return null;
  if (typeof value === "object") {
    value = value.$numberInt ?? value.$numberDouble ?? value.$numberLong ?? value.$numberDecimal ?? null;
    if (value == null) return null;
  }
  if (typeof value === "string") {
    value = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0];
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// ---------------------------------------------------------------- SPECS & FEATURES

function normalizeKey(key) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function prettyKey(key) {
  const letters = key.replace(/[^A-Za-z]/g, "");
  const allOneCase = letters === letters.toLowerCase() || letters === letters.toUpperCase();
  if (!allOneCase) return key;
  return key.toLowerCase().replace(/(^|\s)([a-z])/g, (_, s, c) => s + c.toUpperCase());
}

const EMPTY_VALUE = /^(-+|n\/?a|na|nil|none|null|\.)$/i;

/** Does "Key: Value" look like a spec (short key) rather than a sentence with a colon? */
function splitSpec(text) {
  const idx = text.indexOf(":");
  if (idx <= 0) return null;
  const key = text.slice(0, idx).trim();
  const value = text.slice(idx + 1).trim();
  if (!value || key.length > 40 || key.split(/\s+/).length > 6) return null;
  return { key, value };
}

function buildFeatures({ features = [], specifications = {}, nameTail = [] }) {
  const specs = new Map();
  const bullets = [];
  const seenBullets = new Set();

  const addSpec = (rawKey, rawValue) => {
    const key = cleanLine(rawKey).replace(/[\s:]+$/, "");
    const value = cleanLine(rawValue);
    if (!key || !value || EMPTY_VALUE.test(value)) return;

    const norm = normalizeKey(key);
    if (dropKeys.has(norm)) return;

    const canonical = keyLookup.get(norm) || prettyKey(key);
    if (!specs.has(canonical)) specs.set(canonical, value);
  };

  const addBullet = (raw) => {
    // The backend splits every feature on ":", so a colon inside a sentence
    // would turn it into a bogus spec. Use a dash instead.
    const text = cleanLine(raw).replace(/\s*:\s*/g, " – ").replace(/^[•\-–\s]+/, "");
    const dedupeKey = text.toLowerCase();
    if (!text || seenBullets.has(dedupeKey)) return;
    seenBullets.add(dedupeKey);
    bullets.push(text);
  };

  // Spec table first: it is the most structured source.
  for (const [key, value] of Object.entries(specifications || {})) {
    addSpec(key, typeof value === "string" ? value : String(value ?? ""));
  }

  for (const feature of features || []) {
    const text = cleanLine(feature);
    if (!text) continue;
    const spec = splitSpec(text);
    if (spec) addSpec(spec.key, spec.value);
    else if (!/^specifications?\s*:?$/i.test(text)) addBullet(text);
  }

  for (const point of nameTail) {
    // "| NEO APPLE SERIES" -> spec "Series: Neo Apple"
    const series = point.match(/^(.+?)\s+series$/i);
    if (series) addSpec("Series", fixAllCaps(series[1]));
    else addBullet(fixAllCaps(point));
  }

  return {
    features: [...bullets, ...[...specs].map(([k, v]) => `${k}: ${v}`)],
    specifications: Object.fromEntries(specs),
  };
}

// ---------------------------------------------------------------- DESCRIPTION

const SPEC_HEADING_TEXT = /^\s*specifications?\s*:?\s*(\n|$)/i;
const SPEC_HEADING_HTML = /^\s*<p>\s*(<strong>|<b>)?\s*specifications?\s*:?\s*(<\/strong>|<\/b>)?\s*<\/p>/i;

function cleanDescriptionText(text = "") {
  let out = cleanBlock(text);
  // "Specifications :Aerofit's new..." -> "Aerofit's new..."
  // "SpecificationsDimension: ..." / "Specifications• ..." (heading glued to the text)
  out = out
    .replace(SPEC_HEADING_TEXT, "")
    .replace(/^\s*specifications?\s*:\s*/i, "")
    .replace(/^\s*specifications?(?=[A-Z•\-–])\s*[•\-–]?\s*/i, "");
  return out.trim();
}

function cleanDescriptionHtml(html = "") {
  return stripInternalNotes(String(html || ""))
    .replace(SPEC_HEADING_HTML, "")
    .replace(/<p>\s*(&nbsp;| )?\s*<\/p>/gi, "")
    .trim();
}


// ---------------------------------------------------------------- IMAGES

function cleanImages(images = [], thumbnail) {
  const out = [];
  for (const raw of [...(images || []), thumbnail]) {
    const src = cleanLine(raw || "");
    if (!/^https?:\/\//i.test(src)) continue;
    if (!out.includes(src)) out.push(src);
  }
  return out;
}

// ---------------------------------------------------------------- MAIN

/**
 * @param {object} raw      product as scraped (or as stored in Mongo)
 * @param {object} options
 * @param {string[]} options.categorySlugs   every category the product was listed in
 * @param {string}   options.currentCategorySlug  category it already has in Mongo
 * @param {Object<string,string>} options.categoryNames  slug -> display name
 */
function normalizeProduct(raw, options = {}) {
  const issues = [];
  const fixed = (code) => issues.push(`fixed:${code}`);

  // ---- name
  const sourceName = cleanLine(raw.sourceName || raw.name || "");
  let { title: name, tail: nameTail } = splitNameTail(sourceName);
  if (nameTail.length) fixed("name_tail_moved_to_features");

  const capsFixed = fixAllCaps(name);
  if (capsFixed !== name) fixed("name_case");
  name = capsFixed;

  // ---- sku
  const sku = cleanSku(raw.sku);
  if (raw.sku && !sku) fixed("sku_placeholder_removed");

  // ---- brand (needs the cleaned name)
  const { brand, source: brandSource } = detectBrand({
    brand: raw.brand,
    specifications: raw.specifications,
    name,
    sku,
  });
  if (brand && brand !== raw.brand) {
    fixed(raw.brand && brandSource === "scraped" ? "brand_spelling" : `brand_from_${brandSource}`);
  }

  const brandedName = canonicalizeBrandPrefix(name, brand);
  if (brandedName !== name) fixed("name_brand_spelling");
  name = brandedName;

  // ---- category
  const categorySlugs = options.categorySlugs?.length ? options.categorySlugs : [raw.categorySlug];
  // During a crawl, the scraper passes the category already stored in Mongo
  // (or undefined for a new product). In a backfill, keep what's stored.
  const currentCategorySlug =
    "currentCategorySlug" in options ? options.currentCategorySlug : raw.categorySlug;
  const categorySlug = chooseCategory(categorySlugs, currentCategorySlug);
  const categoryName = cleanLine(
    options.categoryNames?.[categorySlug] ||
      (categorySlug === raw.categorySlug ? raw.categoryName : "") ||
      raw.categoryName ||
      ""
  );
  if (categorySlug !== raw.categorySlug) fixed("category_chosen");

  // ---- prices
  let sellingPrice = toPrice(raw.sellingPrice);
  let mrp = toPrice(raw.mrp);
  if (!sellingPrice && mrp) {
    sellingPrice = mrp;
    fixed("selling_price_from_mrp");
  }
  if (!mrp && sellingPrice) {
    mrp = sellingPrice;
    fixed("mrp_from_selling_price");
  }
  if (mrp && sellingPrice && mrp < sellingPrice) {
    mrp = sellingPrice;
    fixed("mrp_below_selling_price");
  }

  // ---- description
  const descriptionHtml = cleanDescriptionHtml(raw.descriptionHtml);
  let descriptionText = cleanDescriptionText(raw.descriptionText);
  if (!descriptionText && descriptionHtml) {
    descriptionText = cleanDescriptionText(htmlToText(descriptionHtml));
    if (descriptionText) fixed("description_text_from_html");
  }

  // ---- features & specs
  const { features, specifications } = buildFeatures({
    features: raw.features,
    specifications: raw.specifications,
    nameTail,
  });

  // ---- images
  const images = cleanImages(raw.images, raw.thumbnail);
  const thumbnail = images[0] || "";

  // ---- url
  const url = canonicalUrl(raw.url);
  if (url && url !== raw.url) fixed("url_canonical");

  // ---- validation
  if (!name) issues.push("error:missing_name");
  if (!url) issues.push("error:missing_url");
  if (!sellingPrice) issues.push("error:missing_price");
  if (!chooseCategory.isBackendCategory(categorySlug)) issues.push(`error:unmapped_category:${categorySlug}`);
  if (!brand) issues.push("warn:no_brand");
  if (!sku) issues.push("warn:no_sku");
  if (!images.length) issues.push("warn:no_images");
  if (!descriptionText && !features.length) issues.push("warn:no_content");

  return {
    supplier: raw.supplier || "metrosports",
    url,
    name,
    sourceName,
    sku,
    brand,
    categorySlug,
    categoryName,
    mrp,
    sellingPrice,
    currency: raw.currency || "INR",
    descriptionHtml,
    descriptionText,
    features,
    specifications,
    images,
    thumbnail,
    dataIssues: issues,
    normalizerVersion: NORMALIZER_VERSION,
    normalizedAt: new Date(),
  };
}

/** Same slug rule as kreedum_backend/src/utils/generateSlug.js + transformProduct.js. */
function backendSlug(name = "", sku = "") {
  const slugify = (text) =>
    text
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[()'"`]/g, "")
      .replace(/[\\/]/g, "-")
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/[\s-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return sku ? `${slugify(name)}-${slugify(sku)}` : slugify(name);
}

module.exports = normalizeProduct;
module.exports.backendSlug = backendSlug;
module.exports.canonicalUrl = canonicalUrl;
module.exports.NORMALIZER_VERSION = NORMALIZER_VERSION;
