import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

const fromRaw = process.env.FROM_DATE || "2026-04-25T00:00:00+07:00";
const dryRun = process.env.DRY_RUN !== "0";
const backupDir = process.env.BACKUP_DIR || "backups";
const fromDate = new Date(fromRaw);

if (Number.isNaN(fromDate.getTime())) {
  console.error(`[cleanup-crawled-articles] Invalid FROM_DATE: ${fromRaw}`);
  process.exit(1);
}

const where = {
  sourceUrl: { not: null },
  createdAt: { gte: fromDate },
};

try {
  const articles = await prisma.article.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      slug: true,
      sourceUrl: true,
      imageUrl: true,
      status: true,
      createdAt: true,
      publishedAt: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        dryRun,
        fromDate: fromDate.toISOString(),
        count: articles.length,
        sample: articles.slice(0, 10).map((article) => ({
          id: article.id,
          title: article.title,
          status: article.status,
          createdAt: article.createdAt,
          sourceUrl: article.sourceUrl,
          hasImage: Boolean(article.imageUrl),
        })),
      },
      null,
      2
    )
  );

  if (dryRun || articles.length === 0) {
    await prisma.$disconnect();
    process.exit(0);
  }

  await mkdir(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `crawled-articles-before-${fromDate.toISOString().slice(0, 10)}-${Date.now()}.json`
  );

  await writeFile(
    backupPath,
    JSON.stringify(
      {
        fromDate: fromDate.toISOString(),
        deletedAt: new Date().toISOString(),
        articles,
      },
      null,
      2
    ),
    "utf8"
  );

  const deleted = await prisma.article.deleteMany({
    where: {
      id: { in: articles.map((article) => article.id) },
    },
  });

  console.log(
    JSON.stringify(
      {
        deleted: deleted.count,
        backupPath,
      },
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
