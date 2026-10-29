/**
 * Re-clean products that are already in kreedum_supplier_sync.products,
 * so you don't have to re-scrape everything.
 *
 *   npm run normalize                 dry run against MongoDB: prints a report, changes nothing
 *   npm run normalize -- --apply      writes the cleaned fields back to MongoDB
 *   npm run normalize -- --file export.json --tree categories.json --out cleaned.json
 *                                     offline: read a mongoexport JSON array, write the cleaned array
 *
 * Run `npm run categories` first: products are placed in Metro's menu tree.
 *
 * A JSON report (counts + examples per issue) is written to
 * normalize-report.json in the current folder.
 *
 * After --apply, run the backend migrations again:
 *   npm run migrate:products && npm run migrate:normalize-brands && npm run migrate:brands
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const normalizeProduct = require("../normalize/normalizeProduct");
const { backendSlug } = normalizeProduct;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};

// Fields the normalizer owns; nothing else on the document is touched.
const OWNED_FIELDS = [
  "url", "name", "sourceName", "sku", "brand", "categorySlug", "categoryName", "categoryPath",
  "mrp", "sellingPrice", "maxPrice", "options", "variants", "currency", "descriptionHtml", "descriptionText", "shortDescription",
  "features", "specifications", "images", "thumbnail",
  "dataIssues", "normalizerVersion", "normalizedAt",
];

function unwrapExtendedJson(value) {
  if (Array.isArray(value)) return value.map(unwrapExtendedJson);
  if (value && typeof value === "object") {
    if ("$oid" in value) return value.$oid;
    if ("$date" in value) return new Date(value.$date.$numberLong ? Number(value.$date.$numberLong) : value.$date);
    if ("$numberInt" in value) return Number(value.$numberInt);
    if ("$numberDouble" in value) return Number(value.$numberDouble);
    if ("$numberLong" in value) return Number(value.$numberLong);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, unwrapExtendedJson(v)]));
  }
  return value;
}

function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function buildReport(pairs) {
  const issues = {};
  const brandCounts = {};
  const changedFields = {};

  for (const { before, after } of pairs) {
    for (const issue of after.dataIssues) {
      const code = issue;
      issues[code] ??= { count: 0, examples: [] };
      issues[code].count++;
      if (issues[code].examples.length < 5) issues[code].examples.push(after.url);
    }
    brandCounts[after.brand || "(none → backend hides as Unknown)"] =
      (brandCounts[after.brand || "(none → backend hides as Unknown)"] || 0) + 1;

    for (const field of OWNED_FIELDS) {
      if (["dataIssues", "normalizerVersion", "normalizedAt", "sourceName"].includes(field)) continue;
      if (!sameValue(before[field], after[field])) changedFields[field] = (changedFields[field] || 0) + 1;
    }
  }

  // Website slugs must be unique (unique index on KreedumCommerce.products.slug).
  const slugs = new Map();
  for (const { after } of pairs) {
    const slug = backendSlug(after.name, after.sku);
    if (!slugs.has(slug)) slugs.set(slug, []);
    slugs.get(slug).push(after.url);
  }
  const slugCollisions = [...slugs].filter(([, urls]) => urls.length > 1);

  return {
    total: pairs.length,
    changedFields,
    brands: brandCounts,
    issues: Object.fromEntries(Object.entries(issues).sort((a, b) => b[1].count - a[1].count)),
    slugCollisions: Object.fromEntries(slugCollisions),
  };
}

function printReport(report) {
  console.log("====================================");
  console.log(`Products        : ${report.total}`);
  console.log("Fields changed  :");
  console.table(report.changedFields);
  console.log("Brands after    :");
  console.table(report.brands);
  console.log("Issues          :");
  console.table(Object.fromEntries(Object.entries(report.issues).map(([k, v]) => [k, v.count])));
  const collisions = Object.keys(report.slugCollisions).length;
  console.log(`Slug collisions : ${collisions}${collisions ? "  ← these would fail the backend migration" : ""}`);
  console.log("====================================");
}

/** Make website slugs unique by keeping the SKU-less product's Metro Sports URL slug as its SKU. */
function resolveSlugCollisions(pairs) {
  const seen = new Map();
  for (const pair of pairs) {
    const slug = backendSlug(pair.after.name, pair.after.sku);
    if (!seen.has(slug)) seen.set(slug, []);
    seen.get(slug).push(pair);
  }
  for (const group of seen.values()) {
    if (group.length < 2) continue;
    for (const pair of group.slice(1)) {
      const urlSlug = new URL(pair.after.url).pathname.split("/").filter(Boolean).pop();
      pair.after.sku = pair.after.sku ? `${pair.after.sku}-${urlSlug}` : urlSlug;
      pair.after.dataIssues.push("fixed:slug_collision_sku_from_url");
    }
  }
}

async function runOffline(file, outFile, treeFile) {
  const products = unwrapExtendedJson(JSON.parse(fs.readFileSync(file, "utf8")));
  const categoryTree = treeFile ? unwrapExtendedJson(JSON.parse(fs.readFileSync(treeFile, "utf8"))) : undefined;
  const pairs = products.map((before) => ({ before, after: normalizeProduct(before, { categoryTree }) }));
  resolveSlugCollisions(pairs);

  const report = buildReport(pairs);
  printReport(report);
  fs.writeFileSync("normalize-report.json", JSON.stringify(report, null, 2));

  if (outFile) {
    const cleaned = pairs.map(({ before, after }) => ({ ...before, ...after }));
    fs.writeFileSync(outFile, JSON.stringify(cleaned, null, 2));
    console.log(`💾 Cleaned products written to ${path.resolve(outFile)}`);
  }
  console.log(`📝 Report written to ${path.resolve("normalize-report.json")}`);
}

async function runDatabase(apply) {
  const mongoose = require("mongoose");
  const connectDB = require("../config/db");
  const Product = require("../models/product.model");
  const Category = require("../models/category.model");

  await connectDB();

  const [products, categoryTree] = await Promise.all([
    Product.find({ supplier: "metrosports" }).lean(),
    Category.find({ supplier: "metrosports", isActive: true }).lean(),
  ]);

  if (!categoryTree.some((node) => node.level)) {
    throw new Error("Category tree is missing. Run `npm run categories` first.");
  }

  const pairs = products.map((before) => ({
    before,
    after: normalizeProduct(before, { categoryTree }),
  }));
  resolveSlugCollisions(pairs);

  const report = buildReport(pairs);
  printReport(report);
  fs.writeFileSync("normalize-report.json", JSON.stringify(report, null, 2));
  console.log(`📝 Report written to ${path.resolve("normalize-report.json")}`);

  if (!apply) {
    console.log("Dry run — nothing was written. Re-run with --apply to save these changes.");
    await mongoose.disconnect();
    return;
  }

  // URL is the upsert key; refuse to apply if canonicalising would merge two products.
  const urlOwners = new Map();
  for (const { before, after } of pairs) {
    if (urlOwners.has(after.url) && urlOwners.get(after.url) !== String(before._id)) {
      throw new Error(`Two products would share URL ${after.url}; resolve manually before --apply.`);
    }
    urlOwners.set(after.url, String(before._id));
  }

  const operations = pairs.map(({ before, after }) => ({
    updateOne: {
      filter: { _id: before._id },
      update: { $set: Object.fromEntries(OWNED_FIELDS.map((f) => [f, after[f]])) },
    },
  }));

  let modified = 0;
  for (let i = 0; i < operations.length; i += 500) {
    const result = await Product.bulkWrite(operations.slice(i, i + 500), { ordered: false });
    modified += result.modifiedCount;
  }

  console.log(`✅ Updated ${modified} products in kreedum_supplier_sync.products`);
  console.log("Next, in kreedum_backend run:");
  console.log("  npm run migrate:products && npm run migrate:normalize-brands && npm run migrate:brands");

  await mongoose.disconnect();
}

(async () => {
  const file = option("--file");
  if (file) await runOffline(file, option("--out"), option("--tree"));
  else await runDatabase(flag("--apply"));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
