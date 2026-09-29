const cheerio = require("cheerio");
const request = require("../utils/request");
const detectBrand = require("../utils/detectBrand");

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

if (!brand) {
  const title = name.toLowerCase();

  if (title.includes("aerofit")) brand = "Aerofit";
  else if (title.includes("assault")) brand = "Assault Fitness";
}

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
const descriptionHtml =
  $(".woocommerce-product-details__short-description").html()?.trim() || "";

const descriptionText = $(".woocommerce-product-details__short-description")
  .text()
  .replace(/\n+/g, "\n")
  .replace(/[ \t]+/g, " ")
  .replace(/\n\s+/g, "\n")
  .trim();


  // ---------------- FEATURES ----------------
const features = [];

$(".woocommerce-product-details__short-description li").each((_, li) => {
  const text = cleanText($(li).text());

  if (text) {
    features.push(text);
  }
});

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
  status: "scraped",
  lastScrapedAt: new Date(),
  lastError: null,
};
}




module.exports = {
  fetchProductDetails,
};
