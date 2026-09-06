const fs = require("fs-extra");
const path = require("path");

const crawlMenu = require("../crawlers/menu.crawler");
const logger = require("../utils/logger");

const OUTPUT = path.join(
  process.cwd(),
  "data",
  "categories.json"
);

const saveCategories = async () => {
  const categories = await crawlMenu();

  await fs.ensureDir(path.dirname(OUTPUT));

  await fs.writeJSON(OUTPUT, categories, {
    spaces: 2
  });

  let level1 = categories.length;
  let level2 = 0;
  let level3 = 0;

  categories.forEach((cat) => {
    level2 += cat.children.length;

    cat.children.forEach((sub) => {
      level3 += sub.children.length;
    });
  });

  logger.info("📁 Categories saved.");
  logger.info(`L1 : ${level1}`);
  logger.info(`L2 : ${level2}`);
  logger.info(`L3 : ${level3}`);

  return categories;
};

module.exports = {
  saveCategories
};