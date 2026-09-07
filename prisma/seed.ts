/* Seed script for didikpme - PME AI Analyzer */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const existing = await prisma.user.findUnique({
    where: { email: "admin@didikpme.id" },
  });

  if (existing) {
    console.log("Seed data already exists. Skipping.");
    return;
  }

  const org = await prisma.organization.create({
    data: {
      name: "Laboratorium Klinik DidikPME (Demo)",
      slug: "didikpme-demo",
      plan: "PRO",
      monthlyAiLimit: 100,
    },
  });

  const passwordHash = await bcrypt.hash("demo1234", 10);

  await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Admin Laboratorium",
      email: "admin@didikpme.id",
      passwordHash,
      role: "ADMIN",
    },
  });

  await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Analis QA",
      email: "analis@didikpme.id",
      passwordHash,
      role: "ANALYST",
    },
  });

  await prisma.laboratory.create({
    data: {
      organizationId: org.id,
      name: "Lab Utama - DidikPME Demo",
      code: "LAB-01",
    },
  });

  await prisma.zscoreRule.create({
    data: {
      organizationId: org.id,
      ruleVersion: "v1.0-default",
      satisfactoryLimit: 2,
      warningLimit: 3,
      isActive: true,
    },
  });

  console.log("Seed completed:");
  console.log("  Organization:", org.name);
  console.log("  Login: admin@didikpme.id / demo1234 (ADMIN)");
  console.log("  Login: analis@didikpme.id / demo1234 (ANALYST)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
