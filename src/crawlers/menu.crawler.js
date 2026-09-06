const cheerio = require("cheerio");
const request = require("../utils/request");
const config = require("../config/scraper.config");
const logger = require("../utils/logger");

const slugify = require("slugify");

const buildNode = (name, url, level, parent = null) => ({
  name: name.trim(),
  slug: slugify(name.trim(), {
    lower: true,
    strict: true
  }),
  url,
  level,
  parent,
  children: []
});

const crawlMenu = async () => {
  logger.info("📂 Crawling Metro Sports Mega Menu");

  const html = await request(config.baseUrl);

  const $ = cheerio.load(html);

  const categories = [];

  $(".main-navigation .menu > li").each((_, level1) => {
    const level1Anchor = $(level1).children("a");

    const level1Name = level1Anchor.text().trim();

    if (!level1Name) return;

    const level1Node = buildNode(
      level1Name,
      level1Anchor.attr("href"),
      1
    );

    $(level1)
      .find("> ul.sub-menu > li")
      .each((__, level2) => {
        const level2Anchor = $(level2).children("a");

        const level2Name = level2Anchor.text().trim();

        if (!level2Name) return;

        const level2Node = buildNode(
          level2Name,
          level2Anchor.attr("href"),
          2,
          level1Node.slug
        );

        $(level2)
          .find("> ul.sub-menu > li")
          .each((___, level3) => {
            const level3Anchor = $(level3).children("a");

            const level3Name = level3Anchor.text().trim();

            if (!level3Name) return;

            level2Node.children.push(
              buildNode(
                level3Name,
                level3Anchor.attr("href"),
                3,
                level2Node.slug
              )
            );
          });

        level1Node.children.push(level2Node);
      });

    categories.push(level1Node);
  });

  logger.info(`✅ Found ${categories.length} Root Categories`);

  return categories;
};

module.exports = crawlMenu;