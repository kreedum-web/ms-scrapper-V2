const cheerio = require("cheerio");
const request = require("../utils/request");
const { htmlToText } = require("../normalize/text");

function cleanText(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function parsePrice(text) {
  if (!text) return null;

  return Number(
    text
      .replace(/[^\d.,]/g, "")
      .replace(/,/g, "")
      .replace(/\.\d+$/, "")
  );
}

async function fetchProductDetails(product) {
  const html = await request(product.url);
  const $ = cheerio.load(html);


  // ---------------- BASIC ----------------

  const name =
    cleanText($("h1.product_title").first().text()) ||
    product.name;

 let brand = null;

$("table.woocommerce-product-attributes tr").each((_, row) => {
  const key = $(row)
    .find("th")
    .text()
    .trim()
    .toLowerCase();

  if (key.includes("brand")) {
    brand = $(row).find("td").text().trim();
  }
});

// If the attribute table has no brand, normalizeProduct() resolves it from
// the spec table, the product name and the SKU (see src/utils/detectBrand.js).

  const sku = cleanText($(".sku").text()) || null;

  // ---------------- PRICE ----------------

  const mrp = parsePrice(
    $(".price del .amount").first().text()
  );

  const sellingPrice = parsePrice(
    $(".price ins .amount").first().text() ||
      $(".price .amount").first().text()
  );

 


 // ---------- DESCRIPTION ----------
// Most products use the short description next to the price. About a third
// only have content in the "Description" tab, so fall back to that.
const shortDescription = $(".woocommerce-product-details__short-description").first();
const descriptionTab = $("#tab-description, .woocommerce-Tabs-panel--description").first();

const descriptionSource = shortDescription.text().trim()
  ? shortDescription
  : descriptionTab;

// Spec tables are captured into `specifications` below; keep them out of the
// description so their rows ("Brand", "Indicative Price"...) don't show up as text.
const descriptionNode = descriptionSource.clone();
descriptionNode.find("table, script, style").remove();

const descriptionHtml = descriptionNode.html()?.trim() || "";

// One line per paragraph / list item instead of gluing them together.
const descriptionText = htmlToText(descriptionHtml)
  .replace(/[ \t]+/g, " ")
  .replace(/\n\s+/g, "\n")
  .replace(/\n+/g, "\n")
  .trim();


  // ---------------- FEATURES ----------------
const features = [];

const collectFeatures = (container) => {
  container.find("li").each((_, li) => {
    const text = cleanText($(li).text());

    if (text && !features.includes(text)) {
      features.push(text);
    }
  });
};

collectFeatures(shortDescription);

if (!features.length) {
  collectFeatures(descriptionTab);
}

// ---------------- IMAGES ----------------
const images = [];

$(".woocommerce-product-gallery__image a").each((_, image) => {
  const href = $(image).attr("href");

  if (href && !images.includes(href)) {
    images.push(href);
  }
});

// First image becomes thumbnail
const thumbnail = images.length ? images[0] : null;

// ---------- SPECIFICATIONS ----------
const specifications = {};

$("table tr").each((_, row) => {
  const cells = $(row).find("td, th");

  if (cells.length >= 2) {
    const key = $(cells[0]).text().replace(/\s+/g, " ").trim();
    const value = $(cells[1])
  .text()
  .replace(/\s+/g, " ")
  .replace(/\s+,/g, ",")
  .trim();

    if (key && value) {
      specifications[key] = value;
    }
  }
});


// MetroSports sometimes uses normal tables inside description
if (Object.keys(specifications).length === 0) {
  $("#tab-description table tr").each((_, row) => {
    const cells = $(row).find("td");

    if (cells.length >= 2) {
      const key = $(cells[0]).text().trim();
      const value = $(cells[1])
        .text()
        .replace(/\s+/g, " ")
        .trim();

      if (key && value) {
        specifications[key] = value;
      }
    }
  });
}
return {
  ...product,
  // Title from the product page (was computed but never returned before,
  // so the listing-card title was saved instead).
  name,
  brand,
  sku,
  mrp,
  sellingPrice,
  descriptionHtml,
  descriptionText,
  features,
  images,
  thumbnail,
  specifications,
  lastScrapedAt: new Date(),
  lastError: null,
};
}




module.exports = {
  fetchProductDetails,
};
