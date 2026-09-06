require("dotenv").config();
const mongoose = require("mongoose");
const dns = require("dns");

// IMPORTANT: Force Node to use Google DNS
dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

(async () => {
  try {
    console.log("Testing Atlas Connection...");

    const srv = await dns.promises.resolveSrv(
      "_mongodb._tcp.suppliersync.68mq62d.mongodb.net"
    );

    console.log("SRV Records:", srv);

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "kreedum_supplier_sync",
      serverSelectionTimeoutMS: 15000,
    });

    console.log("✅ SUCCESS");
    console.log("Database:", conn.connection.name);
    console.log("Host:", conn.connection.host);

    process.exit(0);
  } catch (err) {
    console.error("❌ FAILED");
    console.dir(err, { depth: 5 });
    process.exit(1);
  }
})();