/**
 * Turn Metro Sports' product-page HTML into a clean Kreedum description.
 *
 * Metro's descriptions are full sales pages. We keep the product content and
 * drop everything that is Metro's own selling, page furniture or duplicated:
 *
 *   kept     intro, "What is …", key features, "Who is it for", other content
 *   dropped  FAQ ("Question: … Answer: …")
 *            "Why Buy … from Metro Sports", "Order … Today", any section about Metro Sports
 *            "Health Benefits" sections (generic, with medical claims)
 *            spec sections — their "Key: Value" lines are returned as specLines
 *              so they end up in the product's specifications instead
 *            sentences naming Metro Sports, its phone number, showrooms, EMI…
 *            staff notes ("confirm from the live page", "before advising a customer")
 *            forms, images, tables, inline styles, classes, links
 *
 * Output HTML uses only <h3>, <p>, <ul>, <li>, <strong>, <em>, <br>.
 *
 * @returns {{ html: string, text: string, short: string, specLines: string[] }}
 */
const cheerio = require("cheerio");
const { cleanLine, decodeEntities, stripInternalNotes } = require("./text");

// ------------------------------------------------------------------ rules

/** Sub-headings of a "Health Benefits" section written at the same level as it. */
const HEALTH_SUB = /\b(pain|blood|diabetes|sugar|cardio|heart|weight (loss|management)|calorie|mental|stress|circulation|spin(e|al)|injury|joint|knee|hip|ankle|lumbar|rehab|health|immun|sleep|bone|posture)\b/i;
const HEALTH_SECTION = /health benefits|benefits of using|supports long-term health/i;

/** Section headings whose whole section is dropped. */
const DROP_SECTION = [
  /frequently asked/i,
  /^faqs?\b/i,
  /^q\d+\s*[:.)]/i, // "Q1: …"
  /^question\b/i,
  /^why (buy|choose|shop)\b/i,
  /^order\b.*\btoday\b/i,
  /metro\s*sports/i,
  HEALTH_SECTION,
  // FAQ written as plain questions ("Is it suitable for a corporate gym?")
  /^(is|are|do|does|can|could|should|will|would|how (much|many|often|long|is|does)|why (is|do|does|should)|which|what (muscles|floor space|size|warranty|is the difference))\b.*\?$/i,
  // sign-offs and Metro's after-sales pitch
  /^let'?s talk\b/i,
  /^conclusion$/i,
  /after-?sales/i,
  /^(get in touch|contact us|enquire now|request a quote)\b/i,
  /^your perfect fitness setup\b/i,
];

/** Section headings that introduce specifications (lines -> specs, sentences kept as features). */
const SPEC_SECTION = [/specifications?\b/i, /^specs?\b/i, /^technical (details|data)\b/i];

/** Headings that only repeat what the page already says ("Description"). */
const DROP_HEADING_ONLY = [
  /^(product )?description\s*:?$/i,
  /^overview\s*:?$/i,
  /\|\s*buy online\b/i, // page title: "Aerofit KFRK-10 Dumbbell Rack | Buy Online at Metro Sports"
];

/** Sentences about Metro Sports as a shop, or notes meant for Metro's staff. */
const DROP_SENTENCE = [
  /metro\s*sports/i,
  /(\+?91[\s-]?)?\b\d{5}[\s-]?\d{5}\b/, // phone numbers
  /\bshowrooms?\b/i,
  /\bEMI\b/,
  /authori[sz]ed\b.*\bdealer/i,
  /\blive (product )?pages?\b/i,
  /\bbefore advising\b/i,
  /\bcall us\b|\bcall\s+(on|at)\b/i,
  /\b(fast|free) (shipping|delivery)\b.*\b(returns?|EMI)\b/i,
];

/** Any heading the rules act on, used to spot titles written as plain paragraphs. */
const SECTION_TITLE = {
  test: (text) =>
    [...DROP_SECTION.filter((re) => !String(re).includes("\\?$")), ...SPEC_SECTION].some((re) => re.test(text)),
};

const SHORT_MAX = 300;

// ------------------------------------------------------------------ helpers

const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Text node -> safe HTML: decode entities, drop "[Intern: …]" notes, normalise spaces and quotes. */
const textNode = (data) =>
  escapeHtml(
    stripInternalNotes(decodeEntities(data))
      .replace(/\u00a0/g, " ")
      .replace(/[\u201c\u201d\u2033]/g, '"')
      .replace(/[\u2018\u2019\u2032]/g, "'")
      .replace(/\s+/g, " ")
  );

/** Inline HTML of a node, keeping only <strong>, <em> and <br>. */
function inlineHtml($, node) {
  let out = "";
  $(node)
    .contents()
    .each((_, child) => {
      if (child.type === "text") {
        out += textNode(child.data);
        return;
      }
      if (child.type !== "tag") return;
      const tag = child.tagName.toLowerCase();
      const inner = inlineHtml($, child);
      if (tag === "br") out += "<br>";
      else if ((tag === "strong" || tag === "b") && inner.trim()) out += `<strong>${inner}</strong>`;
      else if ((tag === "em" || tag === "i") && inner.trim()) out += `<em>${inner}</em>`;
      else out += inner; // a, span, u, … -> unwrapped
    });
  return out;
}

const textOf = (html) =>
  cleanLine(
    html
      .replace(/<br>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
  );

/**
 * Splitting a paragraph on <br> can leave a <strong>/<em> open in one line and
 * closed in the next. Close what is open and open what is closed, per line.
 */
function balanceInline(html) {
  let out = html;
  for (const tag of ["strong", "em"]) {
    const tokens = out.match(new RegExp(`</?${tag}>`, "g")) || [];
    let depth = 0;
    let missingOpen = 0;
    for (const t of tokens) {
      if (t.startsWith("</")) {
        if (depth === 0) missingOpen++;
        else depth--;
      } else depth++;
    }
    out = `<${tag}>`.repeat(missingOpen) + out + `</${tag}>`.repeat(depth);
    out = out.replace(new RegExp(`<${tag}>(\\s*)</${tag}>`, "g"), "$1"); // empty pairs
  }
  return out;
}

/** A <p> made only of bold text ("<p><strong>Key Features</strong></p>") acts as a heading. */
function isBoldOnlyParagraph($, el) {
  if ($(el).find("br").length) return false; // several lines: handled line by line
  const text = cleanLine($(el).text());
  if (!text || text.length > 90 || /[.!]$/.test(text)) return false; // a bold sentence is still text
  const bold = cleanLine($(el).find("strong, b").text());
  return bold === text;
}

const BLOCK_TAGS = new Set(["p", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre"]);

/** Flatten the HTML into a list of blocks in reading order. */
function toBlocks($, root) {
  const blocks = [];

  const walk = (parent) => {
    let loose = ""; // inline content sitting directly inside a container
    const flush = () => {
      if (textOf(loose)) blocks.push({ type: "p", html: loose.trim() });
      loose = "";
    };

    $(parent)
      .contents()
      .each((_, node) => {
        if (node.type === "text") {
          loose += textNode(node.data);
          return;
        }
        if (node.type !== "tag") return;
        const tag = node.tagName.toLowerCase();

        if (/^h[1-6]$/.test(tag)) {
          flush();
          blocks.push({ type: "h", level: Number(tag[1]), html: inlineHtml($, node).replace(/<\/?strong>/g, "") });
        } else if (tag === "p" || tag === "blockquote" || tag === "pre") {
          flush();
          if (isBoldOnlyParagraph($, node)) {
            // a bold line ranks below every real heading
            blocks.push({ type: "h", level: 7, html: escapeHtml(cleanLine($(node).text())) });
          } else {
            // A <br> inside a paragraph separates lines ("Line one<br>Line two").
            // A line that is all bold ("<strong>Conclusion</strong><br>…") is a heading.
            inlineHtml($, node)
              .split(/<br>/)
              .map(balanceInline)
              .forEach((part) => {
                const text = textOf(part);
                if (!text) return;
                const bold = /^\s*<strong>[\s\S]*<\/strong>\s*[:：-]*\s*$/.test(part) && !/<\/strong>[^<]*\S[^<]*<strong>/.test(part);
                // Plain-text section titles ("<p>Frequently Asked Questions</p>") count too.
                const title = text.length <= 90 && !/[.!,]$/.test(text) && SECTION_TITLE.test(text.replace(/\s*[:：]\s*-?\s*$/, ""));
                if ((bold && text.length <= 90 && !/[.!]$/.test(text)) || title) blocks.push({ type: "h", level: 7, html: escapeHtml(text) });
                else blocks.push({ type: "p", html: part.trim() });
              });
          }
        } else if (tag === "ul" || tag === "ol") {
          flush();
          const items = [];
          $(node)
            .children("li")
            .each((__, li) => {
              const html = balanceInline(inlineHtml($, li).replace(/(<br>)+$/g, "").trim());
              if (textOf(html)) items.push(html);
            });
          if (items.length) blocks.push({ type: "ul", items });
        } else if (tag === "br") {
          flush();
        } else if (["strong", "b", "em", "i", "a", "span", "u", "small", "sup", "sub"].includes(tag)) {
          const inner = inlineHtml($, node);
          if ((tag === "strong" || tag === "b") && inner.trim()) loose += `<strong>${inner}</strong>`;
          else if ((tag === "em" || tag === "i") && inner.trim()) loose += `<em>${inner}</em>`;
          else loose += inner;
        } else if (!BLOCK_TAGS.has(tag)) {
          flush();
          walk(node); // div, section, article, header…
        }
      });

    flush();
  };

  walk(root);
  return blocks;
}

/** Split text into sentences, keeping the punctuation. */
const sentences = (text) => text.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((s) => s.trim()).filter(Boolean) || [];

/** Remove Metro / staff sentences. Returns the (possibly rewritten) inline HTML, or "" if nothing is left. */
function scrubSentences(html) {
  const text = textOf(html);
  if (!DROP_SENTENCE.some((re) => re.test(text))) return html;
  const kept = sentences(text).filter((s) => !DROP_SENTENCE.some((re) => re.test(s)));
  return kept.length ? escapeHtml(kept.join(" ")) : "";
}

/** "Max User Weight: 150 kg" — a short key, a colon, a value. */
function asSpecLine(text) {
  const match = text.match(/^([^:]{2,40}?)\s*[:：]\s*(.+)$/);
  if (!match) return null;
  const [, key, value] = match;
  if (key.split(/\s+/).length > 6 || /^(question|answer)$/i.test(key)) return null;
  return `${cleanLine(key)}: ${cleanLine(value)}`;
}

function shortFrom(paragraphs) {
  const first = paragraphs.find((p) => p.length > 40) || paragraphs[0] || "";
  if (first.length <= SHORT_MAX) return first;

  let out = "";
  for (const s of sentences(first)) {
    if ((out + " " + s).trim().length > SHORT_MAX) break;
    out = (out + " " + s).trim();
  }
  if (out) return out;

  const cut = first.slice(0, SHORT_MAX - 1);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

// ------------------------------------------------------------------ main

function cleanDescription(rawHtml = "") {
  const empty = { html: "", text: "", short: "", specLines: [] };
  if (!rawHtml || !String(rawHtml).trim()) return empty;

  const $ = cheerio.load(String(rawHtml), null, false);
  $("script, style, noscript, form, input, button, textarea, select, label, img, picture, svg, iframe, video, table, hr").remove();
  $("[data-widget_type*='form']").remove();
  // FAQ accordion widgets
  $("[id*='accordion'], [class*='accordion']").remove();

  const blocks = toBlocks($, $.root());

  const out = [];
  const specLines = [];
  let mode = "keep"; // keep | drop | spec
  let modeLevel = 0; // heading level that started the drop / spec section
  let inHealth = false; // dropping a "Health Benefits" section

  for (const block of blocks) {
    if (block.type === "h") {
      const raw = textOf(block.html);
      const heading = raw.replace(/\s*[:：]\s*-?\s*$/, "");
      const inside = mode !== "keep" && block.level > modeLevel; // sub-heading of the current section

      if (mode === "drop" && inside) continue;
      if (mode === "drop" && inHealth && HEALTH_SUB.test(heading)) continue;

      // Page-title lines ("… | Buy Online at Metro Sports"): drop the line, keep what follows.
      if (DROP_HEADING_ONLY.some((re) => re.test(raw))) {
        mode = "keep";
        modeLevel = 0;
        inHealth = false;
        continue;
      }

      if (mode === "spec" && inside && heading.length <= 40) {
        out.push({ type: "pendingKey", key: heading }); // "Display" + next line "LCD" -> spec
        continue;
      }

      if (DROP_SECTION.some((re) => re.test(heading))) {
        mode = "drop";
        modeLevel = block.level;
        inHealth = HEALTH_SECTION.test(heading);
        continue;
      }
      inHealth = false;
      if (SPEC_SECTION.some((re) => re.test(heading))) {
        mode = "spec";
        modeLevel = block.level;
        out.push({ type: "h", text: "Features" });
        continue;
      }

      mode = "keep";
      modeLevel = 0;
      out.push({ type: "h", text: heading });
      continue;
    }

    if (mode === "drop") continue;

    const items = block.type === "ul" ? block.items : [block.html];
    const keptItems = [];

    for (const itemHtml of items) {
      const text = textOf(itemHtml);
      if (/^(question|answer)\s*[:：]/i.test(text)) continue; // FAQ outside an FAQ section

      // "Key:" heading followed by its value paragraph
      const prev = out[out.length - 1];
      if (prev?.type === "pendingKey") {
        out.pop();
        if (text.length <= 150) {
          specLines.push(`${prev.key}: ${text}`);
          continue;
        }
        out.push({ type: "h", text: prev.key }); // long text: it was a real sub-heading
      }

      if (mode === "spec" && /^[-–•]\s*\S/.test(text) && !/[:：]/.test(text) && text.length <= 40) {
        out.push({ type: "pendingKey", key: text.replace(/^[-–•]\s*/, "") });
        continue;
      }

      const spec = asSpecLine(text);
      if (spec && (mode === "spec" || text.length < 120)) {
        specLines.push(spec);
        continue;
      }

      const scrubbed = scrubSentences(itemHtml);
      if (textOf(scrubbed)) keptItems.push(scrubbed);
    }

    if (!keptItems.length) continue;
    // Inside a spec section, short lines without a sentence ending read better as a list.
    const listLike = mode === "spec" && block.type === "p" && keptItems.every((h) => textOf(h).length <= 80 && !/[.!?]$/.test(textOf(h)));
    if (listLike) {
      const last = out[out.length - 1];
      if (last?.type === "ul") last.items.push(...keptItems);
      else out.push({ type: "ul", items: keptItems });
    } else if (block.type === "ul") out.push({ type: "ul", items: keptItems });
    else keptItems.forEach((html) => out.push({ type: "p", html }));
  }

  // Drop dangling "Key:" lines, headings with nothing under them, and repeated headings.
  const blocksOut = out.filter((b) => b.type !== "pendingKey");
  const final = blocksOut.filter((b, i) => {
    if (b.type !== "h") return true;
    const next = blocksOut[i + 1];
    return next && next.type !== "h";
  });

  const html = final
    .map((b) =>
      b.type === "h"
        ? `<h3>${escapeHtml(b.text)}</h3>`
        : b.type === "ul"
          ? `<ul>${b.items.map((i) => `<li>${i}</li>`).join("")}</ul>`
          : `<p>${b.html}</p>`
    )
    .join("");

  const text = final
    .map((b) => (b.type === "h" ? b.text : b.type === "ul" ? b.items.map((i) => `• ${textOf(i)}`).join("\n") : textOf(b.html)))
    .join("\n\n");

  // Short summary: first real paragraph, or the first list item if there are only lists.
  let paragraphs = final.filter((b) => b.type === "p").map((b) => textOf(b.html));
  if (!paragraphs.length) paragraphs = final.filter((b) => b.type === "ul").flatMap((b) => b.items.map(textOf));

  return {
    html,
    text,
    short: shortFrom(paragraphs),
    specLines: [...new Set(specLines)],
  };
}

module.exports = cleanDescription;
