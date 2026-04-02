const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table'")
  .then(r => { console.log(JSON.stringify(r, null, 2)); process.exit(0); })
  .catch(e => { console.error("ERROR:", e.message); process.exit(1); });
