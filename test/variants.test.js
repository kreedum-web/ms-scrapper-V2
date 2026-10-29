// Run with: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const cheerio = require("cheerio");

const { parseVariations } = require("../src/crawlers/variations");
const normalizeVariants = require("../src/normalize/normalizeVariants");
const normalizeProduct = require("../src/normalize/normalizeProduct");

const variation = (id, weight, price, regular, extra = {}) => ({
  variation_id: id,
  attributes: { "attribute_pa_simple-weight": weight },
  sku: "",
  display_price: price,
  display_regular_price: regular,
  is_in_stock: true,
  is_purchasable: true,
  image: { full_src: `https://metrosports.co.in/img-${id}.png` },
  ...extra,
});

// Trimmed copy of metrosports.co.in/product/everise-fitness-vinyl-dumbbells/
const page = (variations) => `
<form class="variations_form cart" data-product_id="12221"
  data-product_variations="${JSON.stringify(variations).replace(/"/g, "&quot;")}">
  <table class="variations"><tbody><tr>
    <th class="label"><label for="pa_simple-weight">Weight</label></th>
    <td class="value"><select id="pa_simple-weight" name="attribute_pa_simple-weight" data-attribute_name="attribute_pa_simple-weight">
      <option value="">Choose an option</option>
      <option value="0-5kg">0.5KG</option><option value="1kg">1KG</option><option value="2kg">2KG</option>
    </select></td>
  </tr></tbody></table>
</form>`;

const dumbbells = [
  variation(7027, "0-5kg", 649, 650),
  variation(7028, "1kg", 1299, 1300),
  variation(7029, "2kg", 2599, 2600, { is_in_stock: false }),
];

test("reads option names, labels and every variation from the product page", () => {
  const raw = parseVariations(cheerio.load(page(dumbbells)));
  assert.equal(raw.productId, "12221");
  assert.deepEqual(raw.options, [
    {
      key: "attribute_pa_simple-weight",
      name: "Weight",
      values: [
        { value: "0-5kg", label: "0.5KG" },
        { value: "1kg", label: "1KG" },
        { value: "2kg", label: "2KG" },
      ],
    },
  ]);
  assert.equal(raw.variations.length, 3);
  assert.deepEqual(raw.variations[1], {
    id: "7028",
    attributes: { "attribute_pa_simple-weight": "1kg" },
    sku: "",
    sellingPrice: 1299,
    mrp: 1300,
    inStock: true,
    image: "https://metrosports.co.in/img-7028.png",
  });
});

test("a simple product has no options", () => {
  assert.equal(parseVariations(cheerio.load("<form class='cart'></form>")), null);
});

test("too many variations to embed: options are read, variations left to the Store API", () => {
  const html = page(dumbbells).replace(/data-product_variations="[^"]*"/, 'data-product_variations="false"');
  const raw = parseVariations(cheerio.load(html));
  assert.equal(raw.variations, null);
  assert.equal(raw.options[0].values.length, 3);
});

test("each option keeps its own price; labels are tidied", () => {
  const { options, variants } = normalizeVariants(parseVariations(cheerio.load(page(dumbbells))));
  assert.deepEqual(options, [{ name: "Weight", values: ["0.5 kg", "1 kg", "2 kg"] }]);
  assert.deepEqual(
    variants.map((v) => [v.variantId, v.label, v.sellingPrice, v.mrp, v.inStock]),
    [
      ["7027", "0.5 kg", 649, 650, true],
      ["7028", "1 kg", 1299, 1300, true],
      ["7029", "2 kg", 2599, 2600, false],
    ]
  );
  assert.deepEqual(variants[0].options, { Weight: "0.5 kg" });
});

test("'any value' variations become one entry per value at the same price", () => {
  const raw = {
    options: [
      { key: "attribute_size", name: "Size", values: [{ value: "S", label: "S" }, { value: "M", label: "M" }] },
      { key: "attribute_colour", name: "colour", values: [{ value: "Red", label: "RED" }, { value: "Blue", label: "BLUE" }] },
    ],
    variations: [
      { id: "1", attributes: { attribute_size: "S", attribute_colour: "" }, sellingPrice: 100, mrp: 120, inStock: true },
      { id: "2", attributes: { attribute_size: "M", attribute_colour: "Blue" }, sellingPrice: 150, mrp: 0, inStock: true },
    ],
  };
  const { options, variants } = normalizeVariants(raw);
  assert.deepEqual(options, [
    { name: "Size", values: ["S", "M"] },
    { name: "Colour", values: ["Red", "Blue"] },
  ]);
  assert.deepEqual(
    variants.map((v) => [v.variantId, v.label, v.sellingPrice, v.mrp]),
    [
      ["1-1", "S / Red", 100, 120],
      ["1-2", "S / Blue", 100, 120],
      ["2", "M / Blue", 150, 150],
    ]
  );
});

test("options without prices are dropped and reported", () => {
  const raw = { options: [{ key: "a", name: "Size", values: [{ value: "x", label: "X" }] }], variations: null };
  const result = normalizeVariants(raw);
  assert.deepEqual(result.variants, []);
  assert.deepEqual(result.issues, ["warn:options_without_prices"]);
});

test("product price is the cheapest option in stock, with that option's MRP", () => {
  const raw = parseVariations(
    cheerio.load(page([variation(1, "0-5kg", 649, 900, { is_in_stock: false }), variation(2, "1kg", 1299, 1300), variation(3, "2kg", 4799, 5000)]))
  );
  const product = normalizeProduct({
    supplier: "metrosports",
    url: "https://metrosports.co.in/product/vinyl/",
    name: "Everise Fitness Vinyl Dumbbells",
    brand: "Everise Fitness",
    sellingPrice: 649,
    mrp: null,
    images: ["https://metrosports.co.in/a.jpg"],
    descriptionText: "Hello",
    sourceOptions: raw,
  });
  assert.equal(product.sellingPrice, 1299);
  assert.equal(product.mrp, 1300);
  assert.equal(product.maxPrice, 4799);
  assert.equal(product.variants.length, 3);
  assert.ok(product.dataIssues.includes("fixed:price_from_options"));
});

test("products without options are unchanged", () => {
  const product = normalizeProduct({
    url: "https://metrosports.co.in/product/x/",
    name: "Bench",
    sellingPrice: 900,
    mrp: 1000,
    images: ["https://metrosports.co.in/a.jpg"],
  });
  assert.deepEqual([product.sellingPrice, product.mrp, product.maxPrice], [900, 1000, 900]);
  assert.deepEqual(product.options, []);
  assert.deepEqual(product.variants, []);
});

test("weights are listed in number order, not Metro's alphabetical order", () => {
  const values = ["10KG X 1 PAIR", "12.5KG X 1 PAIR", "2.5KG X 1 PAIR", "5KG X 1 PAIR"];
  const raw = {
    options: [{ key: "w", name: "WEIGHT", values: values.map((label, i) => ({ value: `v${i}`, label })) }],
    variations: values.map((_, i) => ({ id: String(i), attributes: { w: `v${i}` }, sellingPrice: 100 + i, mrp: 0 })),
  };
  const { options, variants } = normalizeVariants(raw);
  assert.deepEqual(options, [{ name: "Weight", values: ["2.5 kg x 1 Pair", "5 kg x 1 Pair", "10 kg x 1 Pair", "12.5 kg x 1 Pair"] }]);
  assert.deepEqual(variants.map((v) => v.label), options[0].values);
});

test("messy option names are tidied", () => {
  const { cleanOptionName } = normalizeVariants;
  assert.equal(cleanOptionName("size-38mm"), "Size 38mm");
  assert.equal(cleanOptionName("SIZE IN INCH"), "Size in Inch");
  assert.equal(cleanOptionName("COLOUR"), "Colour");
});

test("clothing sizes go small to large; units are tidied", () => {
  const raw = (labels) => ({
    options: [{ key: "s", name: "Size", values: labels.map((label, i) => ({ value: `v${i}`, label })) }],
    variations: labels.map((_, i) => ({ id: String(i), attributes: { s: `v${i}` }, sellingPrice: 100, mrp: 0 })),
  });
  assert.deepEqual(normalizeVariants(raw(["Extra Large", "Large", "Medium", "Small", "XS"])).options[0].values, [
    "XS", "Small", "Medium", "Large", "Extra Large",
  ]);
  assert.deepEqual(normalizeVariants(raw(["15Mtrs", "12mtrs", "85Cms", "1.0 KG X 1 PAIR"])).options[0].values, [
    "1 kg x 1 Pair", "12 m", "15 m", "85 cm",
  ]);
});
