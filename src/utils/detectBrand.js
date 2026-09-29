const brandDictionary = require("../config/brandDictionary");

function detectBrand(name = "") {
  const title = name.toLowerCase();

  for (const [keyword, brand] of Object.entries(brandDictionary)) {
    if (title.includes(keyword)) {
      return brand;
    }
  }

  return "";
}

module.exports = detectBrand;