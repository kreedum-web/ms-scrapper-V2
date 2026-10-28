/**
 * Spec keys as the backend expects them.
 *
 * The backend turns every "Key: Value" string in product.features into
 * product.specifications[Key], and its enrichProducts migration reads these
 * exact keys: "Warranty", "Max User Weight", "Dimensions", "Weight".
 * So every spelling variant must collapse to one key.
 *
 * Lookup is by the key lowercased with punctuation removed
 * ("Max. User Weight" -> "max user weight").
 */
const aliases = {
  "Max User Weight": [
    "max user weight",
    "maximum user weight",
    "user weight",
    "user weight capacity",
    "max user weight capacity",
    "maximum user weight capacity",
    "weight limit",
    "weight capacity",
    "max weight capacity",
    "max load",
    "maximum load",
  ],
  Dimensions: [
    "dimension",
    "dimensions",
    "product dimensions",
    "assembled dimensions",
    "assembled dimension",
    "size lxwxh",
    "dimensions lxwxh",
  ],
  Weight: ["weight", "item weight", "product weight", "machine weight", "net weight", "nw", "n w"],
  "Shipping Weight": ["shipping weight", "gross weight", "gw", "g w"],
  "Shipping Dimensions": ["shipping dimensions", "package dimensions", "packing dimensions"],
  Warranty: ["warranty", "product warranty", "warranty period"],
  "Power Requirement": ["power requirement", "power requirements", "power supply"],
  Speakers: ["speaker", "speakers"],
  Programs: ["programs", "program", "pre set programs", "preset programs", "programmes"],
  "Resistance Levels": ["resistance level", "resistance levels"],
  Flywheel: ["fly wheel", "flywheel"],
};

/**
 * Keys never sent to the website: they duplicate other fields, or are
 * supplier pricing/internal data that should not appear as a product spec.
 */
const dropKeys = new Set([
  "brand",
  "category",
  "categories",
  "indicative price",
  "price",
  "mrp",
  "sku",
  "specification",
  "specifications",
]);

const lookup = new Map();
for (const [canonical, list] of Object.entries(aliases)) {
  for (const alias of list) lookup.set(alias, canonical);
}

module.exports = { lookup, dropKeys };
