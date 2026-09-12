const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  console.log("Node:", process.version);
  console.log("URI:", process.env.MONGODB_URI);

  try {
    const srv = await dns.promises.resolveSrv(
      "_mongodb._tcp.suppliersync.68mq62d.mongodb.net"
    );
    console.log("SRV OK:", srv);
  } catch (err) {
    console.log("SRV ERROR:", err);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "KreedumCommerce",
      serverSelectionTimeoutMS: 10000,
    });

    console.log("✅ CONNECTED");
    await mongoose.disconnect();
  } catch (err) {
    console.log("MONGOOSE ERROR:");
    console.log(err);
  }
})();