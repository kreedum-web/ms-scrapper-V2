require("dotenv").config();

const { fetchProductDetails } = require("./src/crawlers/product.crawler");

(async () => {
  const product = {
    supplier: "metrosports",
    categorySlug: "commercial-assault-bike",
    categoryName: "Commercial Assault Bikes",
    name: "Aerofit AF-680 Commercial Assault Air Bike",
    slug: "aerofit-af-680-fan-bike",
    url: "https://metrosports.co.in/product/aerofit-af-680-fan-bike/",
  };

  const result = await fetchProductDetails(product);

  console.log(JSON.stringify(result, null, 2));
})();