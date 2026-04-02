const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || "admin@adnai.bot";
  const name = process.argv[3] || "ADN Admin";

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "VIP", name, chatCount: 0 },
    create: {
      name,
      email,
      role: "VIP",
      chatCount: 0,
    },
  });

  console.log(`VIP access ready for Clerk account: ${user.email}`);
  await prisma.$disconnect();
}

main();
