const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    mongoose.set("strictQuery", true);

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "kreedum_supplier_sync",
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000
    });

    logger.info("✅ MongoDB Atlas Connected");
    logger.info(`🌍 Database: ${conn.connection.name}`);
    logger.info(`📦 Host: ${conn.connection.host}`);
  } catch (error) {
    logger.error("❌ MongoDB Connection Failed");
    logger.error(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;