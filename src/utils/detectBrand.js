const KNOWN_BRANDS = [
  "Aerofit",
  "USI",
  "Anza",
  "Cosco",
  "Yonex",
  "Nivia",
  "Head",
  "Li-Ning",
  "Adidas",
  "Nike",
  "Puma",
  "Reebok",
  "Assault Fitness",
  "Stag",
  "Butterfly",
  "Vector X",
  "SG",
  "SS"
];

function detectBrand(name = "") {
  const productName = name.toLowerCase();

  for (const brand of KNOWN_BRANDS) {
    if (productName.includes(brand.toLowerCase())) {
      return brand;
    }
  }

  return "";
}

module.exports = detectBrand;