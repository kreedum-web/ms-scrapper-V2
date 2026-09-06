require("dotenv").config();

const connectDB = require("./src/config/db");
const { getCategories } = require("./src/services/category.service");

(async () => {
  await connectDB();

  const categories = await getCategories();

  console.log("\nTotal Categories:", categories.length);

  console.table(
    categories.slice(0, 10).map((c) => ({
      name: c.name,
      slug: c.slug,
    }))
  );

  process.exit(0);
})();