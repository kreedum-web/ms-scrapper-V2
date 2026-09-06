require("dotenv").config();

const { fetchProductListings } = require("./src/crawlers/listing.crawler");

(async () => {
  const category = {
    supplier: "metrosports",
    name: "Commercial Assault Bikes",
    slug: "commercial-assault-bike",
    url: "https://metrosports.co.in/product-category/commercial-assault-bike/",
  };

  const products = await fetchProductListings(category);

  console.log("\n========================");
  console.log(`Total Products: ${products.length}`);
  console.log("========================\n");

  console.log(products.slice(0, 5));
})();