
# Kreedum Supplier Sync

A Node.js-based supplier catalogue synchronization service that keeps Kreedum Sports' product data aligned with Metro Sports.

The application crawls supplier categories and product listings, extracts product details and WooCommerce variations, normalizes supplier data into Kreedum's product structure, and synchronizes the catalogue with MongoDB.

**Supplier:** Metro Sports  
**Project:** Kreedum Supplier Sync  
**Repository:** `kreedum-web/ms-scrapper-V2`  
**Runtime:** Node.js  
**Database:** MongoDB

---

## 1. Overview

This project provides an automated supplier catalogue synchronization pipeline.

### Core capabilities

- **Category Discovery:** Automatically extracts the complete supplier category hierarchy from the Metro Sports navigation menu.
- **Product Listing Crawling:** Crawls category pages and discovers product listings.
- **Product Extraction:** Collects product names, descriptions, images, pricing, SKU, brand, specifications and stock information.
- **Variation Extraction:** Supports WooCommerce variable products with multiple options and variation-specific pricing.
- **Store API Integration:** Uses the WooCommerce Store API when variation data is not embedded in the product page.
- **Product Normalization:** Converts inconsistent supplier data into a standardized Kreedum-compatible structure.
- **Incremental Synchronization:** Scrapes only new, outdated or version-mismatched products.
- **Batch Processing:** Saves products through MongoDB bulk operations.
- **Sync Recovery:** Resumes interrupted synchronization runs.
- **Product Lifecycle Management:** Detects removed products, handles URL changes and reactivates returned products.
- **Automated Scheduling:** Supports recurring synchronization through cron.
- **Sync Monitoring:** Maintains execution history, progress, errors and performance statistics.

---

## 2. Technology Stack

| Technology | Purpose |
|---|---|
| Node.js | Application runtime |
| Axios | HTTP requests |
| Cheerio | HTML parsing |
| MongoDB | Product data storage |
| Mongoose | Database modelling |
| node-cron | Scheduled synchronization |
| p-limit | Concurrency management |
| Winston | Application logging |
| dotenv | Environment configuration |
| slugify | Category and text slug generation |
| Node.js Test Runner | Automated testing |

---

## 3. Project Architecture

The application follows a modular architecture that separates crawling, normalization, persistence and synchronization.

```text
Metro Sports Website
        |
        v
 Category Discovery
        |
        v
 Category Crawler
        |
        v
 Product Listing Crawler
        |
        v
 Product Detail Crawler
        |
        +----------------------+
        |                      |
        v                      v
 Product Information     WooCommerce Variations
                               |
                               v
                       WooCommerce Store API
                               |
        +----------------------+
        |
        v
 Product Normalization
        |
        v
 Data Validation
        |
        v
 MongoDB Batch Synchronization
        |
        +----------------------+
        |                      |
        v                      v
 Product Collection       SyncRun Collection
        |
        v
 Kreedum Backend
```

### Main application flow

1. Connect to MongoDB.
2. Load supplier categories and existing products.
3. Retrieve the stored category hierarchy.
4. Crawl category listing pages.
5. Collect and canonicalize product URLs.
6. Identify new and outdated products.
7. Detect products moved to new URLs.
8. Fetch product details and variations.
9. Normalize extracted information.
10. Validate product quality.
11. Save products using MongoDB bulk writes.
12. Detect removed products.
13. Update synchronization statistics.

---

## 4. Repository Structure

```text
ms-scrapper-V2/
│
├── src/
│   │
│   ├── config/
│   │   ├── db.js
│   │   ├── scraper.config.js
│   │   ├── selectors.js
│   │   ├── brandDictionary.js
│   │   ├── backendCategories.js
│   │   └── featureKeys.js
│   │
│   ├── crawlers/
│   │   ├── menu.crawler.js
│   │   ├── category.crawler.js
│   │   ├── listing.crawler.js
│   │   ├── product.crawler.js
│   │   └── variations.js
│   │
│   ├── models/
│   │   ├── category.model.js
│   │   ├── product.model.js
│   │   └── SyncRun.js
│   │
│   ├── normalize/
│   │   ├── normalizeProduct.js
│   │   ├── normalizeVariants.js
│   │   ├── chooseCategory.js
│   │   ├── cleanDescription.js
│   │   ├── skuFromName.js
│   │   └── text.js
│   │
│   ├── scheduler/
│   │   └── daily.scheduler.js
│   │
│   ├── jobs/
│   │   └── scheduler.js
│   │
│   ├── scripts/
│   │   └── normalize-existing.js
│   │
│   ├── services/
│   │   ├── category.service.js
│   │   ├── product.service.js
│   │   ├── scraper.service.js
│   │   └── sync.service.js
│   │
│   ├── utils/
│   │   ├── detectBrand.js
│   │   ├── logger.js
│   │   ├── request.js
│   │   ├── resolveRedirect.js
│   │   └── delay.js
│   │
│   └── index.js
│
├── test/
│   ├── normalize.test.js
│   └── variants.test.js
│
├── data/
├── package.json
└── README.md
```

---

## 5. Installation and Setup

### Prerequisites

- Node.js 20+
- MongoDB or MongoDB Atlas
- npm
- Internet connectivity to Metro Sports

### Clone Repository

```bash
git clone https://github.com/kreedum-web/ms-scrapper-V2.git

cd ms-scrapper-V2
```

### Install Dependencies

```bash
npm install
```

### Environment Configuration

Create a `.env` file in the project root.

```env
# Supplier Configuration
SUPPLIER_NAME=metrosports
BASE_URL=https://metrosports.co.in/

# MongoDB
MONGODB_URI=your_mongodb_connection_string

# Crawling Configuration
CATEGORY_CONCURRENCY=5
PAGE_CONCURRENCY=5
SCRAPER_CONCURRENCY=20
SCRAPER_BATCH_SIZE=100

# Retry Configuration
SCRAPER_RETRY_COUNT=3
REQUEST_DELAY_MS=0

# Scheduler Configuration
SCHEDULER_ENABLED=true
SCHEDULER_CRON=0 2 * * *
```

**Important:** Check `src/config/db.js` for the exact MongoDB environment variable expected by the database connection module.

Never commit `.env` or production credentials to GitHub.

---

## 6. Running the Application

### Available Commands

| Command | Description |
|---|---|
| `npm start` | Start the application |
| `npm run dev` | Start development mode |
| `npm run categories` | Crawl and save supplier categories |
| `npm run products` | Execute complete product synchronization |
| `npm run scheduler` | Start scheduled synchronization |
| `npm test` | Run automated tests |

### Initial Setup

Before the first product synchronization, the category hierarchy must be populated.

```bash
npm run categories
```

This extracts the supplier's main menu and stores its category hierarchy in MongoDB.

After category discovery:

```bash
npm run products
```

### Manual Product Synchronization

```bash
npm run products
```

This executes the complete catalogue synchronization process.

### Scheduled Synchronization

```bash
npm run scheduler
```

The scheduler runs continuously and triggers synchronization according to `SCHEDULER_CRON`.

Default configuration:

```env
SCHEDULER_CRON=0 2 * * *
```

This runs every day at 02:00 according to the server's timezone.

#### Example Cron Expressions

| Expression | Schedule |
|---|---|
| `0 2 * * *` | Daily at 2 AM |
| `0 */4 * * *` | Every 4 hours |
| `0 */6 * * *` | Every 6 hours |
| `0 0 * * *` | Daily at midnight |

The scheduler checks whether another synchronization is already running before starting a new one.

---

## 7. Product Synchronization System

The synchronization engine is implemented in:

```text
src/services/scraper.service.js
```

It coordinates the entire scraping and synchronization lifecycle.

### Incremental Scraping

The application does not scrape every product on every execution.

A product is eligible for scraping when:

- It is newly discovered.
- It has never been scraped.
- Its last scrape is older than 24 hours.
- Its stored scraper version is older than the current scraper version.

The current stale threshold is 24 hours.

### Scraper Versioning

The scraper maintains a version identifier in:

```text
src/crawlers/product.crawler.js
```

Whenever extraction logic changes significantly, increment `SCRAPER_VERSION`.

This allows the application to identify products scraped using an older extraction implementation and refresh them.

### Batch Processing

Products are processed in configurable batches.

```env
SCRAPER_BATCH_SIZE=100
SCRAPER_CONCURRENCY=20
```

MongoDB bulk writes reduce the number of database operations and improve synchronization performance.

---

## 8. Product Variations

The scraper supports WooCommerce variable products.

For example, a dumbbell product may have multiple weight options:

```text
Dumbbell
   |
   +-- 0.5 KG
   +-- 1 KG
   +-- 1.5 KG
   +-- 2 KG
   +-- 3 KG
```

Each variation can contain:

- Variation ID
- SKU
- Attributes
- Selling price
- MRP
- Availability
- Variation image

### Variation Extraction

The variation crawler is implemented in:

```text
src/crawlers/variations.js
```

It supports two extraction mechanisms:

**1. Embedded WooCommerce Data**

Extracts variation information from:

```html
<form class="variations_form">
```

The `data-product_variations` attribute contains the variation payload when WooCommerce embeds it in the page.

**2. WooCommerce Store API**

Some products contain too many variations for WooCommerce to embed in the HTML.

In such cases, the scraper retrieves variation information using:

```text
/wp-json/wc/store/v1/products/{product_id}
```

Individual variation details are then retrieved using their variation IDs.

The normalization layer converts both extraction methods into a consistent structure.

---

## 9. Product Normalization

Product normalization is one of the most important parts of this project.

The main implementation is:

```text
src/normalize/normalizeProduct.js
```

Its purpose is to transform inconsistent supplier information into a standardized product structure compatible with Kreedum's backend.

### Normalized Product Fields

| Field | Description |
|---|---|
| `name` | Cleaned product name |
| `sourceName` | Original supplier product name |
| `brand` | Canonical brand name |
| `sku` | Supplier SKU or extracted model code |
| `url` | Canonical product URL |
| `categorySlug` | Selected backend-compatible category |
| `mrp` | Maximum retail price |
| `sellingPrice` | Selling price |
| `maxPrice` | Highest variation price |
| `images` | Product image collection |
| `features` | Normalized product specifications |
| `descriptionText` | Clean text description |
| `descriptionHtml` | Clean HTML description |
| `options` | Product option definitions |
| `variants` | Product variation records |
| `dataIssues` | Data quality diagnostics |

### Normalization Features

- Product title cleanup.
- Brand detection and standardization.
- SKU and model-code extraction.
- Category mapping.
- Price validation.
- Description cleanup.
- Specification extraction.
- Feature standardization.
- Variation normalization.
- Duplicate listing handling.
- Canonical URL generation.

### Brand Mapping

Brand mappings are maintained in:

```text
src/config/brandDictionary.js
```

This ensures different supplier spellings resolve to consistent brand names.

### Category Mapping

Backend-compatible categories are maintained in:

```text
src/config/backendCategories.js
```

The category mapping should remain aligned with the Kreedum backend.

### Specification Mapping

Canonical specification keys are maintained in:

```text
src/config/featureKeys.js
```

This ensures similar supplier specifications use consistent field names.

---

## 10. Product Lifecycle Management

The synchronization engine also manages product availability and catalogue changes.

### New Products

New products are inserted using MongoDB upsert operations.

### Updated Products

Existing products are updated using their canonical URLs.

### Failed Products

Failed scrapes do not overwrite previously stored good product information.

The error is recorded so the product can be retried during a subsequent synchronization.

### Rejected Products

Products without valid product images are rejected.

Existing records are marked inactive rather than retaining invalid product information.

### Removed Products

Products that no longer appear in supplier category listings are marked inactive.

### Reactivated Products

If an inactive product reappears and is successfully scraped, it is reactivated.

### Moved Product URLs

When Metro Sports changes a product URL, the scraper attempts to resolve the previous URL.

If the redirect points to a newly discovered product URL, the existing record is relinked instead of creating a duplicate.

Previous URLs are retained in `previousUrls`.

### Removal Safety Mechanism

The scraper includes a safeguard against mass deactivation.

If the number of discovered live listings is unexpectedly low compared with the active catalogue, the removal check is skipped.

This helps prevent accidental deactivation when the supplier website is unavailable or its layout changes.

---

## 11. Synchronization Monitoring

Every synchronization execution is recorded in MongoDB through the `SyncRun` model.

Implementation:

```text
src/models/SyncRun.js
src/services/sync.service.js
```

### Tracked Information

- Supplier name.
- Sync status.
- Start and completion timestamps.
- Total categories scanned.
- Total listings discovered.
- Products scraped.
- Products skipped.
- Products inserted.
- Products updated.
- Products removed.
- Products reactivated.
- Failed products.
- Duplicate listings.
- Current batch.
- Total batches.
- Progress percentage.
- Last processed category.
- Last processed product.
- Success rate.
- Health status.
- Execution duration.
- Error information.

### Health Status

The current implementation calculates synchronization health using the success rate and failed-product count.

| Status | Meaning |
|---|---|
| `healthy` | Normal synchronization |
| `warning` | More than 20 failed products |
| `failed` | Success rate below 95% |

These statuses are stored in the synchronization record.

---

## 12. Re-normalizing Existing Products

Existing MongoDB product records can be normalized without scraping supplier pages again.

Available commands:

```bash
npm run normalize
```

Runs normalization in dry-run mode and generates a report.

```bash
npm run normalize:apply
```

Applies normalized data to existing MongoDB records.

For JSON exports:

```bash
node src/scripts/normalize-existing.js --file products.json --out cleaned.json
```

Review the generated report before applying changes to production data.

### Backend Migration

After preparing the normalized supplier data, the corresponding backend migration workflow can be executed from the `kreedum_backend` repository.

```bash
npm run migrate:products
npm run migrate:normalize-brands
npm run migrate:brands
npm run migrate:enrich-products
```

Refer to the backend repository for the current migration requirements.

---

## 13. Testing

Run the complete automated test suite:

```bash
npm test
```

Current test coverage includes:

- Product normalization.
- Variant normalization.

Test files:

```text
test/
├── normalize.test.js
└── variants.test.js
```

The repository also contains diagnostic scripts for inspecting supplier pages, categories, listings and product extraction.

---

## 14. Configuration Reference

| Environment Variable | Default | Description |
|---|---|---|
| `SUPPLIER_NAME` | `metrosports` | Supplier identifier |
| `BASE_URL` | Metro Sports URL | Supplier website |
| `CATEGORY_CONCURRENCY` | `5` | Concurrent category workers |
| `PAGE_CONCURRENCY` | `5` | Concurrent page workers |
| `SCRAPER_CONCURRENCY` | `20` | Concurrent product workers |
| `SCRAPER_BATCH_SIZE` | `100` | Products per batch |
| `SCRAPER_RETRY_COUNT` | `3` | Request retry count |
| `REQUEST_DELAY_MS` | `0` | Request delay |
| `SCHEDULER_ENABLED` | `false` | Scheduler configuration flag |
| `SCHEDULER_CRON` | `0 2 * * *` | Scheduled execution time |

Actual runtime behavior should be verified against the corresponding configuration modules.

---

## 15. Deployment Considerations

For production deployment:

- Use MongoDB Atlas or a managed MongoDB instance.
- Configure environment variables securely.
- Use persistent hosting for the scheduler process.
- Avoid running multiple scheduler instances for the same supplier.
- Configure concurrency according to available CPU and memory.
- Monitor synchronization failures.
- Monitor supplier website changes.
- Test normalization changes before production deployment.
- Keep the scraper version updated when extraction logic changes.

**Important:** The scheduler uses `node-cron` inside the Node.js process. It requires the application to remain running continuously. A stopped or sleeping process cannot execute scheduled jobs.

---

## 16. Related Repositories

**Kreedum Backend**

https://github.com/kreedum-web/kreedum_backend

**Kreedum Sports Website**

https://github.com/kreedum-web/kreedum-sports

---

## 17. Project Purpose

Kreedum Supplier Sync is part of Kreedum Sports' internal product catalogue infrastructure.

Its objective is to automate supplier catalogue collection, standardize product information, maintain accurate product availability and provide reliable synchronized data for the Kreedum ecommerce platform.

---

**Maintained by Kreedum Sports Development Team**
