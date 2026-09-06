require("dotenv").config();

const { fetchCategories } = require("./src/crawlers/category.crawler");

(async () => {
  const categories = await fetchCategories(process.env.BASE_URL);

  const mustExist = [
    "commercial-treadmill",
    "domestic-treadmills",
    "commercial-rowing-machines",
    "semi-commercial-rowing-machines",
    "commercial-assault-bike",
    "commercial-spin-bikes",
    "commercial-upright-bikes",
    "domestic-cross-trainers",
    "fitness-accessories",
    "gym-equipment",
  ];

  for (const slug of mustExist) {
    const found = categories.find((c) => c.slug === slug);
    console.log(slug, found ? "✅" : "❌");
  }
})();