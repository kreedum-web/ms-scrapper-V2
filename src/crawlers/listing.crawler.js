// const cheerio = require("cheerio");
// const request = require("../utils/request");

// async function getPaginationInfo(categoryUrl) {
//   let currentUrl = categoryUrl;
//   let totalPages = 1;

//   while (true) {
//     const html = await request(currentUrl);
//     const $ = cheerio.load(html);

//     // Look for the "next page" button.
//     const nextPage = $("a.next.page-numbers").attr("href");

//     if (!nextPage) break;

//     totalPages++;
//     currentUrl = nextPage;
//   }

//   return { totalPages };
// }

// module.exports = { getPaginationInfo };


const cheerio = require("cheerio");
const request = require("../utils/request");

async function fetchProductListings(category) {
  let currentUrl = category.url;
  let page = 1;

  const products = [];

  while (currentUrl) {
    console.log(`📄 Crawling Page ${page}: ${currentUrl}`);

    const html = await request(currentUrl);
    const $ = cheerio.load(html);

    // Each product card
    $("li.product").each((_, element) => {
      const productLink = $(element)
        .find("a.woocommerce-LoopProduct-link")
        .attr("href");

      const productName = $(element)
        .find("h2.woocommerce-loop-product__title")
        .text()
        .trim();

      if (!productLink || !productName) return;

      const slug = productLink
        .split("/product/")[1]
        ?.replace(/\/$/, "");

      products.push({
        supplier: category.supplier,
        categorySlug: category.slug,
        categoryName: category.name,
        name: productName,
        slug,
        url: productLink,
      });
    });

    // Find Next page
    const nextPage = $("a.next.page-numbers").attr("href");

    if (nextPage) {
      currentUrl = nextPage;
      page++;
    } else {
      currentUrl = null;
    }
  }

  return products;
}

module.exports = {
  fetchProductListings,
};