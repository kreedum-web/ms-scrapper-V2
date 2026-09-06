const mongoose = require("mongoose");
const dns = require("dns");
const logger = require("../utils/logger");

// Fix SRV lookup issue on Windows
dns.setDefaultResultOrder("ipv4first");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "kreedum_supplier_sync",
      serverSelectionTimeoutMS: 15000,
    });

    logger.info("✅ MongoDB Connected");
  } catch (error) {
    logger.error("❌ MongoDB Connection Failed");
    logger.error(error.message);
    process.exit(1);
  }
}

module.exports = connectDB;