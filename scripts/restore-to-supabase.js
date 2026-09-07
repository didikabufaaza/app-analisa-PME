const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const db = new PrismaClient();

async function restore() {
  if (!fs.existsSync("scripts/sqlite_dump.json")) {
    console.error("scripts/sqlite_dump.json not found.");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync("scripts/sqlite_dump.json", "utf8"));
  console.log("Restoring data to Supabase PostgreSQL...");

  // 1. Organizations
  for (const item of data.organizations) {
    await db.organization.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      },
    });
  }
  console.log(" - Organizations restored:", data.organizations.length);

  // 2. Laboratories
  for (const item of data.laboratories) {
    await db.laboratory.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        createdAt: new Date(item.createdAt),
      },
    });
  }
  console.log(" - Laboratories restored:", data.laboratories.length);

  // 3. Users
  for (const item of data.users) {
    await db.user.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      },
    });
  }
  console.log(" - Users restored:", data.users.length);

  // 4. ZscoreRules
  for (const item of data.zscoreRules) {
    await db.zscoreRule.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        effectiveDate: new Date(item.effectiveDate),
        createdAt: new Date(item.createdAt),
      },
    });
  }
  console.log(" - ZscoreRules restored:", data.zscoreRules.length);

  // 5. PmeSessions
  for (const item of data.pmeSessions) {
    await db.pmeSession.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      },
    });
  }
  console.log(" - PmeSessions restored:", data.pmeSessions.length);

  // 6. PmeFiles
  for (const item of data.pmeFiles) {
    await db.pmeFile.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        createdAt: new Date(item.createdAt),
      },
    });
  }
  console.log(" - PmeFiles restored:", data.pmeFiles.length);

  // 7. PmeResults
  for (const item of data.pmeResults) {
    await db.pmeResult.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      },
    });
  }
  console.log(" - PmeResults restored:", data.pmeResults.length);

  // 8. AiAnalyses
  for (const item of data.aiAnalyses) {
    await db.aiAnalysis.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        createdAt: new Date(item.createdAt),
      },
    });
  }
  console.log(" - AiAnalyses restored:", data.aiAnalyses.length);

  // 9. CapaActions
  for (const item of data.capaActions) {
    await db.capaAction.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        dueDate: item.dueDate ? new Date(item.dueDate) : null,
        closedAt: item.closedAt ? new Date(item.closedAt) : null,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      },
    });
  }
  console.log(" - CapaActions restored:", data.capaActions.length);

  // 10. AiUsageLogs
  for (const item of data.aiUsageLogs) {
    await db.aiUsageLog.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        createdAt: new Date(item.createdAt),
      },
    });
  }
  console.log(" - AiUsageLogs restored:", data.aiUsageLogs.length);

  // 11. AuditLogs
  for (const item of data.auditLogs) {
    await db.auditLog.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        createdAt: new Date(item.createdAt),
      },
    });
  }
  console.log(" - AuditLogs restored:", data.auditLogs.length);

  console.log("\n>>> All data successfully migrated to Supabase PostgreSQL! <<<");
}

restore().then(() => process.exit(0)).catch((err) => {
  console.error("Restore failed:", err);
  process.exit(1);
});
