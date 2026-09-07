require("dotenv").config();

const { getPaginationInfo } = require("./src/crawlers/listing.crawler");

(async () => {
  const result = await getPaginationInfo(
    "https://metrosports.co.in/product-category/attachments-for-machines/"
  );

   console.log("Total Pages:", result.totalPages);
})();