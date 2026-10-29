# Kreedum Supplier Sync

## Data normalization (backend contract)

Every scraped product is passed through `src/normalize/normalizeProduct.js`
before it is saved, so `kreedum_supplier_sync.products` always matches what
`kreedum_backend`'s `npm run migrate:products` expects:

| Field | Guarantee |
|---|---|
| `url` | `https://`, trailing slash, no query/hash (it's the backend's upsert key) |
| `name` | clean title; selling points after ` I ` / ` \| ` move to `features`; ALL-CAPS titles title-cased. Original kept in `sourceName` |
| `brand` | one canonical spelling, from spec table → name → `AF-` SKU (`src/config/brandDictionary.js`) |
| `sku` | Metro's SKU; if Metro has none, the model code from the name (`Aerofit AF-2952 …` → `AF-2952`); otherwise `""` (never `N/A`) |
| `categorySlug` | one slug from the backend's `categoryMap` (`src/config/backendCategories.js`), chosen deterministically when a product is in several categories |
| `mrp`, `sellingPrice` | positive numbers, `mrp >= sellingPrice` |
| `features` | bullets, then `Key: Value` lines with canonical keys (`Max User Weight`, `Dimensions`, `Weight`, `Warranty`… in `src/config/featureKeys.js`) — the spec table is merged in here because the backend only reads `features` |
| `descriptionText/Html` | no `Specifications :` heading, no `[Intern: …]` supplier notes |
| `dataIssues` | `error:*` / `warn:*` / `fixed:*` codes. Find problems with `db.products.find({ dataIssues: /^error:/ })` |

**Products with no images** (Metro shows only its placeholder picture) are treated as discontinued: the sync never saves them, and an existing copy is marked inactive.

**Re-clean data that's already in MongoDB** (no re-scrape needed):

```bash
npm run normalize          # dry run: prints a report, writes normalize-report.json
npm run normalize:apply    # saves the cleaned fields
# then in kreedum_backend:
npm run migrate:products && npm run migrate:normalize-brands && npm run migrate:brands && npm run migrate:enrich-products
```

Offline against a `mongoexport` file: `node src/scripts/normalize-existing.js --file products.json --out cleaned.json`

**Keep in sync with the backend:** when a category is added to
`kreedum_backend/src/migration/categoryMap.js`, add its slug to
`src/config/backendCategories.js`. When Metro Sports adds a brand, add it to
`src/config/brandDictionary.js`.

Tests: `npm test`
