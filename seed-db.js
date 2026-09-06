require("dotenv").config();
const mongoose = require("mongoose");
const dns = require("dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "kreedum_supplier_sync",
    });

    const Category = mongoose.connection.collection("categories");

    await Category.insertOne({
      name: "Cardio",
      slug: "cardio",
      supplier: "metrosports",
      createdAt: new Date(),
    });

    console.log("✅ Inserted first category document.");

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
})();