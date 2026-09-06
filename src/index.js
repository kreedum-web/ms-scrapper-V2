require("dotenv").config();
const connectDB = require("./config/db");
const { fetchCategories } = require("./crawlers/category.crawler");
const { saveCategories } = require("./services/category.service");

(async () => {
  await connectDB();

  if (process.argv.includes("--categories")) {
    const categories = await fetchCategories(process.env.BASE_URL);

    console.log(categories);

    const result = await saveCategories(categories);

    console.log(result);

    process.exit(0);
  }
  if (process.argv.includes("--products")) {
  await connectDB();
  await syncProductListings();
  process.exit(0);
}
})();