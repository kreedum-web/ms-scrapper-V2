/**
 * Scrape ONE product fresh and compare it with what's stored in MongoDB.
 * Read-only: nothing is written to the database.
 *
 *   node compare-product.js
 *   node compare-product.js https://metrosports.co.in/product/some-product/
 *
 * Output: compare/<product-slug>.json with
 *   old         the product as it is in kreedum_supplier_sync.products now
 *   newScraped  what the crawler pulls from the page (before cleaning)
 *   newCleaned  what will actually be saved (after normalizeProduct)
 *   changes     field-by-field: old value vs new value, for fields that differ
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const connectDB = require("./src/config/db");
const Product = require("./src/models/product.model");
const Category = require("./src/models/category.model");
const { fetchProductDetails } = require("./src/crawlers/product.crawler");
const normalizeProduct = require("./src/normalize/normalizeProduct");

const DEFAULT_URL = "https://metrosports.co.in/product/aerofit-af-680-fan-bike/";

const FIELDS = [
  "name", "brand", "sku", "categorySlug", "categoryName", "categoryPath",
  "mrp", "sellingPrice", "descriptionText", "descriptionHtml",
  "features", "specifications", "images", "thumbnail", "url",
];

(async () => {
  const url = normalizeProduct.canonicalUrl(process.argv[2] || DEFAULT_URL);

  await connectDB();

  const [old, categories] = await Promise.all([
    Product.findOne({ url }).lean(),
    Category.find({ supplier: "metrosports", isActive: true }).lean(),
  ]);

  if (!old) {
    console.log(`⚠️ Not in MongoDB yet: ${url} (only the new version will be saved)`);
  }

  const listing = old
    ? {
        supplier: old.supplier,
        categorySlug: old.categorySlug,
        categoryName: old.categoryName,
        name: old.sourceName || old.name,
        slug: old.slug,
        url,
      }
    : {
        supplier: "metrosports",
        categorySlug: "",
        categoryName: "",
        name: "",
        slug: url.split("/").filter(Boolean).pop(),
        url,
      };

  console.log(`🔎 Scraping ${url}`);
  const newScraped = await fetchProductDetails(listing);

  if (!categories.some((c) => c.level)) {
    console.log("⚠️ No category tree yet — run `npm run categories` first for categoryPath.");
  }

  const newCleaned = normalizeProduct(newScraped, {
    currentCategorySlug: old?.categorySlug,
    categoryTree: categories,
  });

  const changes = {};
  for (const field of FIELDS) {
    const before = old?.[field] ?? null;
    const after = newCleaned[field] ?? null;
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes[field] = { old: before, new: after };
    }
  }

  const outDir = path.join(__dirname, "compare");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${listing.slug}.json`);

  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        url,
        comparedAt: new Date(),
        dataIssues: newCleaned.dataIssues,
        changes,
        old,
        newScraped,
        newCleaned,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("====================================");
  console.log(`Fields changed : ${Object.keys(changes).join(", ") || "none"}`);
  console.log(`Data issues    : ${newCleaned.dataIssues.join(", ") || "none"}`);
  console.log(`💾 Saved to ${outFile}`);
  console.log("====================================");
})()
  .catch((error) => {
    console.error("❌", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
