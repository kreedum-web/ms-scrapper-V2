require("dotenv").config();

const { getPaginationInfo } = require("./src/crawlers/listing.crawler");

(async () => {
//   const category =
//     "https://metrosports.co.in/product-category/treadmills/";
// const category =
//   "https://metrosports.co.in/product-category/exercise-bikes/";
const category =
  "https://metrosports.co.in/shop/";
// const category =
//   "https://metrosports.co.in/product-category/fitness-accessories/";

  const result = await getPaginationInfo(category);

  console.log(result);
})();