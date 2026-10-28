// Run with: npm test
const test = require("node:test");
const assert = require("node:assert/strict");

const normalizeProduct = require("../src/normalize/normalizeProduct");
const chooseCategory = require("../src/normalize/chooseCategory");
const { fixAllCaps } = require("../src/normalize/text");
const { backendSlug, canonicalUrl } = normalizeProduct;

const base = {
  supplier: "metrosports",
  url: "https://metrosports.co.in/product/test-product/",
  categorySlug: "commercial-treadmill",
  categoryName: "Commercial Treadmill",
  name: "Test Product",
  sku: "AF-1",
  brand: "Aerofit",
  mrp: 1000,
  sellingPrice: 900,
  features: [],
  specifications: {},
  images: ["https://metrosports.co.in/a.jpg"],
  descriptionText: "Hello",
  descriptionHtml: "<p>Hello</p>",
};

const run = (overrides, options) => normalizeProduct({ ...base, ...overrides }, options);

test("brand comes from the spec table when the scraped field is empty", () => {
  const p = run({ brand: null, specifications: { Brand: "XPEED" } });
  assert.equal(p.brand, "Xpeed");
});

test("brand comes from the product name, any casing", () => {
  assert.equal(run({ brand: null, name: "EVERISE FITNESS ODS-308 CYCLE" }).brand, "Everise Fitness");
  assert.equal(run({ brand: null, name: "PowerMax Fitness BR-400 Bike" }).brand, "Powermax Fitness");
});

test("brand comes from an Aerofit model SKU as a last resort", () => {
  assert.equal(run({ brand: null, name: "Aerobic Stepper", sku: "AF-001AS" }).brand, "Aerofit");
  assert.equal(run({ brand: null, name: "Foam Pad", sku: "AF-BP6" }).brand, "");
});

test("brand-name substrings don't produce false matches", () => {
  // "headphones" contains "head", "sg" etc. — none are in the dictionary as substrings
  assert.equal(run({ brand: null, name: "Assault Air Bike", sku: "X1" }).brand, "");
});

test("name marketing tail moves to features; series becomes a spec", () => {
  const p = run({ name: "Air Hockey SDX I Multi-Colour Frame I Digital Scoring" });
  assert.equal(p.name, "Air Hockey SDX");
  assert.deepEqual(p.features.slice(0, 2), ["Multi-Colour Frame", "Digital Scoring"]);

  const s = run({ name: "Aerofit AF-4471 Half Rack | NEO APPLE SERIES" });
  assert.equal(s.name, "Aerofit AF-4471 Half Rack");
  assert.equal(s.specifications.Series, "Neo Apple");
});

test("roman numeral after a dash stays in the name", () => {
  const p = run({ name: "Mini Snooker Table – I Mahogany Tone I Indian Marble Slate I Rubber Cushion" });
  assert.equal(p.name, "Mini Snooker Table – I");
});

test("all-caps names are title-cased, model codes untouched", () => {
  assert.equal(fixAllCaps("AEROFIT 3-JELLY TUBE"), "Aerofit 3-Jelly Tube");
  assert.equal(fixAllCaps("AEROBIC STEPPER AF-006AS BIG"), "Aerobic Stepper AF-006AS Big");
  assert.equal(fixAllCaps("OLYMPIC ROD 28MM WITH COLLARS"), "Olympic Rod 28mm with Collars");
  assert.equal(fixAllCaps("Already Mixed CASE"), "Already Mixed CASE");
});

test("placeholder SKUs become empty", () => {
  assert.equal(run({ sku: "N/A" }).sku, "");
  assert.equal(run({ sku: " AF 1036 " }).sku, "AF 1036");
});

test("prices: missing MRP filled, MRP never below selling price, strings parsed", () => {
  assert.equal(run({ mrp: null, sellingPrice: 500 }).mrp, 500);
  assert.equal(run({ mrp: 400, sellingPrice: 500 }).mrp, 500);
  const p = run({ mrp: "₹1,299.00", sellingPrice: "Rs 999" });
  assert.equal(p.mrp, 1299);
  assert.equal(p.sellingPrice, 999);
  assert.ok(run({ mrp: null, sellingPrice: null }).dataIssues.includes("error:missing_price"));
});

test("spec keys collapse to the backend's names; junk keys dropped", () => {
  const p = run({
    features: ["Max. User Weight: 150 kg", "Maximum User Weight: 120 kg", "Builds grip strength"],
    specifications: {
      Brand: "Aerofit",
      Category: "Benches",
      "Indicative Price": "Rs 17,099 [Intern: confirm on live page]",
      Dimension: "44.4” (L) x 16.8” (W)",
    },
  });
  assert.equal(p.specifications["Max User Weight"], "150 kg");
  assert.equal(p.specifications.Dimensions, '44.4" (L) x 16.8" (W)');
  assert.equal(p.specifications.Brand, undefined);
  assert.equal(p.specifications["Indicative Price"], undefined);
  assert.ok(p.features.includes("Builds grip strength"));
  assert.ok(p.features.includes("Max User Weight: 150 kg"));
});

test("sentence bullets never contain ':' (the backend would read them as specs)", () => {
  const p = run({ features: ["Perfect for every home gym enthusiast who trains daily: durable and compact"] });
  assert.ok(p.features.every((f) => !f.includes(":") || /^[^:]{1,40}: /.test(f)));
});

test("supplier [Intern: ...] notes are removed everywhere", () => {
  const p = run({
    descriptionText: "Specifications :Great bench [Intern: copy from live page]",
    descriptionHtml: "<p><strong>Specifications :</strong></p><p>Great bench [Intern: copy from live page]</p>",
    specifications: { Weight: "[Intern: copy from live page]" },
  });
  assert.equal(p.descriptionText, "Great bench");
  assert.equal(p.descriptionHtml, "<p>Great bench</p>");
  assert.equal(p.specifications.Weight, undefined);
});

test("URLs are canonical", () => {
  assert.equal(
    canonicalUrl("http://MetroSports.co.in/product/x?ref=1#top"),
    "https://metrosports.co.in/product/x/"
  );
});

test("unknown category is reported as an error", () => {
  assert.ok(run({ categorySlug: "brand-new-category" }).dataIssues.includes("error:unmapped_category:brand-new-category"));
});

test("category choice is deterministic and sticky", () => {
  assert.equal(chooseCategory(["treadmill", "commercial-treadmill", "miscellaneous"]), "commercial-treadmill");
  assert.equal(chooseCategory(["miscellaneous", "commercial-treadmill"]), "commercial-treadmill");
  // keeps the category the product already has, if still listed there
  assert.equal(chooseCategory(["benches-racks", "single-stations"], "single-stations"), "single-stations");
});

test("backendSlug matches the backend's slug rule", () => {
  assert.equal(backendSlug("Aerofit AH-01 Aluminium D-Cable Handle", "AH-01"), "aerofit-ah-01-aluminium-d-cable-handle-ah-01");
  assert.equal(backendSlug("Plyo Box (3 in 1)", ""), "plyo-box-3-in-1");
});

test("single ' I ' separator splits only between multi-word parts", () => {
  assert.equal(run({ name: "Chrome Plates 28 mm I Chrome Finish Polished" }).name, "Chrome Plates 28 mm");
  assert.equal(run({ name: "Type I Bench" }).name, "Type I Bench");
});

test("description heading glued to the text is removed", () => {
  assert.equal(run({ descriptionText: "SpecificationsDimension: 76\" (L)" }).descriptionText, 'Dimension: 76" (L)');
  assert.equal(run({ descriptionText: "Specifications• Tube Gauge : 3.0mm" }).descriptionText, "Tube Gauge : 3.0mm");
});
