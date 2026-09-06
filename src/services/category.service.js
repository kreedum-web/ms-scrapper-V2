const Category = require("../models/category.model");

async function saveCategories(categories) {
  let inserted = 0;
  let updated = 0;

  for (const category of categories) {
    const result = await Category.updateOne(
      { supplier: category.supplier, slug: category.slug },
      { $set: category },
      { upsert: true }
    );

    if (result.upsertedCount) inserted++;
    else if (result.modifiedCount) updated++;
  }

  return {
    inserted,
    updated,
    total: categories.length,
  };
}

module.exports = {
  saveCategories,
};