require("dotenv").config();

const { fetchCategories } = require("./src/crawlers/category.crawler");

(async () => {
  const categories = await fetchCategories(process.env.BASE_URL);

  console.log("Total:", categories.length);

  console.table(
    categories.slice(0, 20).map((c) => ({
      name: c.name,
      slug: c.slug,
    }))
  );
})();