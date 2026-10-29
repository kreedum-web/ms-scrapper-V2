/**
 * Find a model code in a product name, for products Metro lists without a SKU.
 *
 *   "Aerofit AF-2952 Rowing Lat Pull Down"          -> "AF-2952"
 *   "Aerofit AF 5114 High Row Machine"              -> "AF-5114"
 *   "Xpeed XP- 2481 Aerobic Stepper Pro"            -> "XP-2481"
 *   "Powermax Fitness TAC-225® Motorized Treadmill" -> "TAC-225"
 *   "Aerofit AF-T12 Premium T-Series ..."           -> "AF-T12"
 *   "USI 706FSL Free Standing Punch and Kick Bag"   -> "706FSL"
 *   "Concept2 SkiErg2 Wall Mounted 2715"            -> "2715"
 *
 * Deliberately NOT treated as codes (they'd be wrong or shared by many products):
 *   sizes / weights ("28 mm", "125 kg", "8X4"), series names ("A2 Series",
 *   "T-Series"), versions ("Beast 2.0"), counts ("6 Station").
 *
 * Returns "" when nothing reliable is found.
 */

const UNIT_AFTER = /^\s*(mm|cm|m|kg|kgs|g|lb|lbs|ft|feet|inch|in|"|ltr|l|station|stations|pcs|series)\b/i;

const PATTERNS = [
  // AF-2952, AF-1A, AF-11PR, AF-T12, PMC-2, KFRK-10, XP- 2481, TAC-225, AF-2.0
  /\b([A-Z]{1,5})-\s?([A-Z]?\d+(?:\.\d+)?[A-Z]{0,3})(?![\w-])/,
  // AF 5114 (Metro writes Aerofit codes with a space too)
  /\b(AF)\s(\d{2,5}[A-Z]{0,3})(?![\w-])/,
  // DY5006, IM8020, AWN02 (letters glued to 2+ digits)
  /\b([A-Z]{2,5})(\d{2,5}[A-Z]{0,3})(?![\w-])/,
  // 706FSL, 622S, 2715 (stand-alone model numbers of 3-4 digits)
  /(?:^|\s)(\d{3,4}[A-Z]{0,3})(?![\w.-])/,
];

function skuFromName(name = "") {
  const text = String(name);

  for (const pattern of PATTERNS) {
    const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
    const re = new RegExp(pattern.source, flags);
    let match;

    while ((match = re.exec(text))) {
      const after = text.slice(match.index + match[0].length);
      if (UNIT_AFTER.test(after)) continue;

      const [, prefix, number] = match;
      const code = number === undefined ? prefix : `${prefix}-${number}`;

      // Stand-alone numbers in the hundreds are usually weights/sizes ("125"),
      // unless they carry letters ("622S").
      if (number === undefined && /^\d{3}$/.test(code)) continue;

      return code.toUpperCase();
    }
  }

  return "";
}

module.exports = skuFromName;
