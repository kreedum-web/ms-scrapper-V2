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
  assert.ok(run({ mrp: null, sellingPrice: null }).dataIssues.includes("warn:no_price"));
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
    descriptionHtml: "<p>Great bench [Intern: copy from live page] for home use.</p>",
    specifications: { Weight: "[Intern: copy from live page]" },
  });
  assert.equal(p.descriptionHtml, "<p>Great bench for home use.</p>");
  assert.equal(p.descriptionText, "Great bench for home use.");
  assert.equal(p.specifications.Weight, undefined);
});

test("URLs are canonical", () => {
  assert.equal(
    canonicalUrl("http://MetroSports.co.in/product/x?ref=1#top"),
    "https://metrosports.co.in/product/x/"
  );
});

// A slice of Metro's real menu tree.
const node = (slug, path, name = slug) => ({ slug, path, level: path.length, name });
const tree = [
  node("cardio", ["cardio"], "Cardio"),
  node("treadmill", ["cardio", "treadmill"], "Treadmills"),
  node("commercial-treadmill", ["cardio", "treadmill", "commercial-treadmill"], "Commercial Treadmill"),
  node("strength", ["strength"]),
  node("benches-racks", ["strength", "benches-racks"]),
  node("single-stations", ["strength", "single-stations"]),
  node("weights-bars", ["weights-bars"]),
  node("dumbbells", ["weights-bars", "dumbbells"], "Dumbbells"),
  node("flooring", ["flooring"], "Flooring"),
];
const treeMap = new Map(tree.map((n) => [n.slug, n]));

test("category in the menu tree gets its full path", () => {
  const p = run({ categorySlug: "commercial-treadmill" }, { categoryTree: tree });
  assert.deepEqual(p.categoryPath, ["cardio", "treadmill", "commercial-treadmill"]);
  assert.equal(p.categoryName, "Commercial Treadmill");
});

test("category missing from the menu is reported as an error", () => {
  const p = run({ categorySlug: "brand-new-category" }, { categoryTree: tree });
  assert.ok(p.dataIssues.includes("error:category_not_in_menu:brand-new-category"));
});

test("the product page's own category wins over listing pages", () => {
  const p = run(
    { categorySlug: "treadmill", postedIn: ["commercial-treadmill"] },
    { categoryTree: tree, categorySlugs: ["treadmill", "commercial-treadmill"], currentCategorySlug: undefined }
  );
  assert.equal(p.categorySlug, "commercial-treadmill");
});

test("nested Metro slugs map to the leaf ('weights-bars/dumbbells' -> 'dumbbells')", () => {
  const p = run({ categorySlug: "weights-bars/dumbbells" }, { categoryTree: tree });
  assert.equal(p.categorySlug, "dumbbells");
  assert.deepEqual(p.categoryPath, ["weights-bars", "dumbbells"]);
});

test("department-level products (Flooring) are valid", () => {
  const p = run({ categorySlug: "", postedIn: ["flooring"] }, { categoryTree: tree });
  assert.deepEqual(p.categoryPath, ["flooring"]);
  assert.ok(!p.dataIssues.some((i) => i.startsWith("error:")));
});

test("category choice: deepest wins, ties keep the current category", () => {
  assert.equal(chooseCategory({ listings: ["treadmill", "commercial-treadmill"] }, treeMap), "commercial-treadmill");
  assert.equal(
    chooseCategory({ listings: ["benches-racks", "single-stations"], current: "single-stations" }, treeMap),
    "single-stations"
  );
  assert.equal(chooseCategory({ listings: ["single-stations", "benches-racks"] }, treeMap), "benches-racks");
});

test("backendSlug matches the backend's slug rule", () => {
  assert.equal(backendSlug("Aerofit AH-01 Aluminium D-Cable Handle", "AH-01"), "aerofit-ah-01-aluminium-d-cable-handle-ah-01");
  assert.equal(backendSlug("Plyo Box (3 in 1)", ""), "plyo-box-3-in-1");
});

test("single ' I ' separator splits only between multi-word parts", () => {
  assert.equal(run({ name: "Chrome Plates 28 mm I Chrome Finish Polished" }).name, "Chrome Plates 28 mm");
  assert.equal(run({ name: "Type I Bench" }).name, "Type I Bench");
});

test("description keeps product content and drops Metro's selling, FAQ and junk", () => {
  const html = `
    <p>The AF-106 is a durable <a href="https://metrosports.co.in/x/" style="color:red">hand grip</a>.</p>
    <h2><span style="color:#000"><strong>Key Features</strong></span></h2>
    <ul><li>Builds grip strength</li><li>Compact</li></ul>
    <h3><strong>Specifications</strong></h3>
    <ul><li>Max. User Weight: 120 kg</li></ul>
    <p><strong>Display:</strong></p><p>LCD</p>
    <h3><strong>Frequently Asked Questions</strong></h3>
    <p><strong>Question: Can I adjust it?</strong></p><p><strong>Answer: </strong>No. Confirm from the live product page.</p>
    <h4><strong>Why Buy from Metro Sports</strong></h4>
    <p>Metro Sports is an authorized dealer since 2003.</p>
    <p>Order the AF-106 today and call Metro Sports on +91-99889-99977.</p>
    <form><input type="hidden" name="x"></form>`;
  const p = run({ descriptionHtml: html, features: [] });

  assert.equal(
    p.descriptionHtml,
    '<p>The AF-106 is a durable hand grip.</p><h3>Key Features</h3><ul><li>Builds grip strength</li><li>Compact</li></ul>'
  );
  assert.equal(p.descriptionText, "The AF-106 is a durable hand grip.\n\nKey Features\n\n• Builds grip strength\n• Compact");
  assert.equal(p.shortDescription, "The AF-106 is a durable hand grip.");
  // spec lines from the description become specifications
  assert.equal(p.specifications["Max User Weight"], "120 kg");
  assert.equal(p.specifications.Display, "LCD");
});

test("description: health-claim sections, plain-text titles and Metro page titles", () => {
  const cleanDescription = require("../src/normalize/cleanDescription");
  const r = cleanDescription(`
    <p><strong>Aerofit KFRK-10 Dumbbell Rack | Buy Online at Metro Sports</strong></p>
    <p>A sturdy rack for home gyms.</p>
    <h2>Health Benefits of Using the Rack Daily</h2><p>Better posture.</p>
    <h2>Lower Back Pain Relief</h2><p>Medical claim.</p>
    <h2>Who is it For?</h2><ul><li>Home gyms</li></ul>
    <p>Frequently Asked Questions</p><div class="sp-easy-accordion"><p>Is it heavy? Yes.</p></div>
    <p>-Dimensions<br>48 x 20 in</p>`);
  assert.equal(r.text, "A sturdy rack for home gyms.\n\nWho is it For?\n\n• Home gyms");
});

test("menu parser builds Metro's tree from the menu HTML", () => {
  const { parseMenuTree } = require("../src/crawlers/menu.crawler");
  const html = `<ul class="elementor-nav-menu">
    <li><a href="/our-products/cardio/">Cardio</a><ul>
      <li><a href="/product-category/treadmill/">Treadmills</a><ul>
        <li><a href="/product-category/commercial-treadmill/">Commercial Treadmill</a></li></ul></li></ul></li>
    <li><a href="/our-products/weights-bars/">Weights &amp; Bars</a><ul>
      <li><a href="/product-category/weights-bars/dumbbells/">DUMBBELLS</a></li></ul></li>
    <li><a href="/our-products/accessories/">Accessories</a><ul>
      <li><a href="/product-category/balls/">BALLS</a></li>
      <li><a href="#">OTHER ACCESSORIES</a><ul><li><a href="/product-category/jacket/">Jacket</a></li></ul></li></ul></li>
    <li><a href="/our-products/flooring/">Flooring</a></li>
    <li><a href="/store-locations/">Store Locations</a></li>
  </ul>`;
  const nodes = parseMenuTree(html, "https://metrosports.co.in/");
  const bySlug = Object.fromEntries(nodes.map((n) => [n.slug, n]));

  assert.deepEqual(bySlug["commercial-treadmill"].path, ["cardio", "treadmill", "commercial-treadmill"]);
  assert.equal(bySlug.dumbbells.name, "Dumbbells");
  assert.equal(bySlug.dumbbells.sourceSlug, "weights-bars/dumbbells");
  assert.equal(bySlug["other-accessories"].kind, "group");
  assert.deepEqual(bySlug.jacket.path, ["accessories", "other-accessories", "jacket"]);
  assert.equal(bySlug.flooring.kind, "department");
  assert.equal(bySlug["store-locations"], undefined);
});

test("SKU comes from the model code in the name when Metro has none", () => {
  const skuFromName = require("../src/normalize/skuFromName");
  const cases = {
    "Aerofit AF-2952 Rowing Lat Pull Down": "AF-2952",
    "Aerofit AF 5114 High Row Machine": "AF-5114",
    "Aerofit AF-11PR Weight Plate Rack": "AF-11PR",
    "Aerofit AF-T12 Premium T-Series Commercial Elliptical Cross Trainer": "AF-T12",
    "Xpeed XP- 2481 Aerobic Stepper Pro": "XP-2481",
    "Powermax Fitness TAC-225® Motorized Treadmill with Auto Incline": "TAC-225",
    "USI 706FSL Free Standing Punch and Kick Bag": "706FSL",
    "Concept2 SkiErg2 Wall Mounted 2715": "2715",
    // no reliable code -> empty
    "Aerofit Black Cat Barbell A2 Series with High-Quality Steel Construction": "",
    "Aerofit Beast 2.0 Barbell B1 Series": "",
    "Chrome Plates 28 mm": "",
    "Olympic Rod Max Weight (125 kg) with Corrosion Resistant Surface": "",
    "Aerofit Weight Lifting Platform-3 / Dead Lift Platform 8X4": "",
  };
  for (const [name, sku] of Object.entries(cases)) assert.equal(skuFromName(name), sku, name);

  const p = run({ name: "Aerofit AF-2952 Rowing Lat Pull Down", sku: "" });
  assert.equal(p.sku, "AF-2952");
  assert.ok(p.dataIssues.includes("fixed:sku_from_name"));
  // Metro's own SKU always wins
  assert.equal(run({ name: "Aerofit AF-4306 Vertical Press", sku: "AF-9935" }).sku, "AF-9935");
});

test("placeholder picture is not an image; no images is an error", () => {
  const p = run({
    images: ["https://metrosports.co.in/wp-content/uploads/woocommerce-placeholder-600x600.webp"],
    thumbnail: null,
  });
  assert.deepEqual(p.images, []);
  assert.ok(p.dataIssues.includes("error:no_images"));
});
