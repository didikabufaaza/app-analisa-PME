const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const db = new PrismaClient();

async function dump() {
  const data = {};
  data.organizations = await db.organization.findMany();
  data.laboratories = await db.laboratory.findMany();
  data.users = await db.user.findMany();
  data.pmeSessions = await db.pmeSession.findMany();
  data.pmeFiles = await db.pmeFile.findMany();
  data.pmeResults = await db.pmeResult.findMany();
  data.aiAnalyses = await db.aiAnalysis.findMany();
  data.aiUsageLogs = await db.aiUsageLog.findMany();
  data.capaActions = await db.capaAction.findMany();
  data.zscoreRules = await db.zscoreRule.findMany();
  data.auditLogs = await db.auditLog.findMany();
  data.reports = await db.report.findMany();
  data.extractionLogs = await db.extractionLog.findMany();

  fs.writeFileSync("scripts/sqlite_dump.json", JSON.stringify(data, null, 2), "utf8");
  console.log("Successfully dumped SQLite data:");
  for (const [k, v] of Object.entries(data)) {
    console.log(" - " + k + ": " + v.length + " records");
  }
}

dump().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
