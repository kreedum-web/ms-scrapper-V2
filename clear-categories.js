require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./src/config/db");
const Category = require("./src/models/category.model");

(async () => {
  await connectDB();

  const result = await Category.deleteMany({
    supplier: process.env.SUPPLIER,
  });

  console.log(`Deleted ${result.deletedCount} categories`);

  await mongoose.disconnect();
})();