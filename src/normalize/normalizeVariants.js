/**
 * Turn the raw WooCommerce options of one product (src/crawlers/variations.js)
 * into what the website sells:
 *
 *   options:  [{ name: "Weight", values: ["0.5 kg", "1 kg", …] }]
 *   variants: [{ variantId: "7027", options: { Weight: "0.5 kg" }, label: "0.5 kg",
 *                sku, mrp, sellingPrice, inStock, image }]
 *
 * `variantId` is Metro's variation id: stable across scrapes, so carts and
 * orders that point at a variant keep working after the next sync.
 *
 * Pure function: no network, no database.
 */
const { cleanLine, ACRONYMS } = require("./text");

// Clothing sizes stay upper-case: S, M, XL, XXL, 3XL …
const SIZE = /^(\d?X{0,3}[SML]|\d?XL)$/i;

const SMALL = new Set(["IN", "OF", "OR", "TO", "ON", "AT", "BY", "AND", "FOR", "WITH"]);

/** "RED" -> "Red", "1 PAIR" -> "1 Pair", "SIZE IN INCH" -> "Size in Inch"; "XL", "PU", "PVC" stay. */
function titleCaseCaps(text) {
  return text.replace(/[A-Za-z]+/g, (word, offset) => {
    if (word !== word.toUpperCase() || SIZE.test(word) || ACRONYMS.has(word)) return word;
    if (SMALL.has(word)) return offset === 0 ? word.charAt(0) + word.slice(1).toLowerCase() : word.toLowerCase();
    return word.length >= 3 ? word.charAt(0) + word.slice(1).toLowerCase() : word;
  });
}

const toPrice = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

/** "0.5KG" -> "0.5 kg", "10KG X 1 PAIR" -> "10 kg x 1 Pair", "LARGE" -> "Large". */
function cleanValueLabel(label = "") {
  let text = cleanLine(label);
  text = text.replace(/(\d)\s*(kgs?|kilograms?)\b\.?/gi, "$1 kg");
  text = text.replace(/(\d)\s*(lbs?|pounds?)\b\.?/gi, "$1 lb");
  text = text.replace(/(\d)\s*(mtrs?|meters?|metres?)\b\.?/gi, "$1 m");
  text = text.replace(/(\d)\s*cms\b\.?/gi, "$1 cm");
  text = text.replace(/(\d)\s*(mm|cm|ft|m|oz)\b/gi, (_, d, unit) => `${d} ${unit.toLowerCase()}`);
  text = text.replace(/\b(\d+)\.0+(?= (kg|lb|m|cm|mm|ft)\b)/g, "$1"); // "1.0 kg" -> "1 kg"
  text = text.replace(/(\S)\s+[xX×]\s+(?=\d)/g, "$1 x "); // "10 kg X 1 pair"
  text = titleCaseCaps(text);
  return text;
}

/** "size-38mm" -> "Size 38mm", "SIZE IN INCH" -> "Size In Inch", "COLOUR" -> "Colour". */
function cleanOptionName(name = "") {
  let text = cleanLine(name).replace(/[:*]+$/, "").replace(/[-_]+/g, " ").trim();
  if (!text) return "Option";
  text = text.replace(/(\d)\s*(MM|CM|KG)\b/g, (_, d, unit) => `${d}${unit.toLowerCase()}`);
  text = titleCaseCaps(text);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Clothing / glove sizes, smallest first.
const SIZE_ORDER = [
  ["xxs"], ["xs", "extra small"], ["s", "small"], ["m", "medium"], ["l", "large"],
  ["xl", "extra large"], ["xxl", "2xl", "extra extra large"], ["xxxl", "3xl"],
];
const sizeRank = (label) => SIZE_ORDER.findIndex((names) => names.includes(String(label).trim().toLowerCase()));

/**
 * Metro lists values alphabetically (10, 12.5, 2.5 … / Extra Large, Large,
 * Medium, Small). Put weights and lengths in number order and clothing
 * sizes from small to large; anything else keeps Metro's order.
 */
function sortValues(values) {
  if (values.every((v) => sizeRank(v.label) !== -1)) {
    return [...values].sort((a, b) => sizeRank(a.label) - sizeRank(b.label));
  }
  const number = (label) => parseFloat(String(label).replace(/,/g, ""));
  if (!values.every((v) => Number.isFinite(number(v.label)))) return values;
  return [...values].sort((a, b) => number(a.label) - number(b.label));
}

/**
 * @param {{ options: Array, variations: Array|null } | null} raw
 * @returns {{ options: Array, variants: Array, issues: string[] }}
 */
function normalizeVariants(raw) {
  const issues = [];
  if (!raw || !raw.options?.length) return { options: [], variants: [], issues };

  if (!Array.isArray(raw.variations) || !raw.variations.length) {
    issues.push("warn:options_without_prices");
    return { options: [], variants: [], issues };
  }

  // Option names and value labels, keyed by WooCommerce's attribute key / value slug.
  const options = raw.options.map((option) => ({
    key: option.key,
    name: cleanOptionName(option.name),
    values: sortValues(option.values.map((v) => ({ value: v.value, label: cleanValueLabel(v.label) }))),
  }));

  const variants = [];
  const seen = new Set();

  for (const variation of raw.variations) {
    // WooCommerce allows "any value" for an option (empty string): one entry
    // per value, all at the same price.
    let combos = [{}];
    for (const option of options) {
      const chosen = variation.attributes?.[option.key];
      const values = chosen
        ? [option.values.find((v) => v.value === chosen) || { value: chosen, label: cleanValueLabel(chosen) }]
        : option.values;
      combos = combos.flatMap((combo) => values.map((v) => ({ ...combo, [option.name]: v.label })));
    }

    let sellingPrice = toPrice(variation.sellingPrice);
    let mrp = toPrice(variation.mrp);
    if (!sellingPrice) {
      issues.push("warn:option_without_price");
      continue;
    }
    if (!mrp || mrp < sellingPrice) mrp = sellingPrice;

    combos.forEach((combo, index) => {
      const signature = JSON.stringify(combo);
      if (seen.has(signature)) return; // a more specific variation came first
      seen.add(signature);

      variants.push({
        // "any value" expansions share one Metro variation; keep their ids unique.
        variantId: combos.length > 1 ? `${variation.id}-${index + 1}` : String(variation.id),
        options: combo,
        label: options.map((o) => combo[o.name]).filter(Boolean).join(" / "),
        sku: cleanLine(variation.sku || ""),
        mrp,
        sellingPrice,
        inStock: variation.inStock !== false,
        image: variation.image || "",
      });
    });
  }

  if (!variants.length) {
    issues.push("warn:options_without_prices");
    return { options: [], variants: [], issues };
  }

  // Show options in Metro's order: 0.5 kg, 1 kg, 2 kg …
  const rank = (variant) =>
    options.map((o) => {
      const i = o.values.findIndex((v) => v.label === variant.options[o.name]);
      return i === -1 ? 999 : i;
    });
  variants.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  });

  // Only values that some variant actually sells.
  const outOptions = options
    .map((o) => ({
      name: o.name,
      values: [...new Set(o.values.map((v) => v.label))].filter((label) =>
        variants.some((variant) => variant.options[o.name] === label)
      ),
    }))
    .filter((o) => o.values.length);

  return { options: outOptions, variants, issues };
}

/**
 * The product's listing price when it has options: the cheapest option
 * (preferring ones in stock), with that option's own MRP, plus the highest
 * price for "₹649 – ₹4,799".
 */
function priceFromVariants(variants) {
  if (!variants?.length) return null;
  const pool = variants.some((v) => v.inStock) ? variants.filter((v) => v.inStock) : variants;
  const cheapest = pool.reduce((min, v) => (v.sellingPrice < min.sellingPrice ? v : min), pool[0]);
  return {
    sellingPrice: cheapest.sellingPrice,
    mrp: cheapest.mrp,
    maxPrice: Math.max(...variants.map((v) => v.sellingPrice)),
  };
}

module.exports = normalizeVariants;
module.exports.priceFromVariants = priceFromVariants;
module.exports.cleanValueLabel = cleanValueLabel;
module.exports.cleanOptionName = cleanOptionName;
