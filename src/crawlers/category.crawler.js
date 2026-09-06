const axios = require("axios");
const cheerio = require("cheerio");

async function fetchCategories(baseUrl) {
  const { data } = await axios.get(baseUrl);

  const $ = cheerio.load(data);

  const categories = [];

  $("a").each((_, element) => {
    const name = $(element).text().trim();
    const href = $(element).attr("href");

    if (!href) return;

    if (href.includes(baseUrl) && name.length > 2) {
      categories.push({
        supplier: "metrosports",
        name,
        slug: href.split("/").filter(Boolean).pop(),
        url: href,
      });
    }
  });

  return categories;
}

module.exports = {
  fetchCategories,
};