-- =============================================================================
-- SMARTPME (didikpme) - Supabase PostgreSQL Database Schema
-- Project: LMS-dismartpme (ctcejtsifmjdskygndok)
-- Project URL: https://ctcejtsifmjdskygndok.supabase.co
-- =============================================================================

-- 1. Table: Organization
CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "monthlyAiLimit" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table: Laboratory
CREATE TABLE IF NOT EXISTS "Laboratory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Laboratory_organizationId_idx" ON "Laboratory"("organizationId");

-- 3. Table: User
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "menuAccess" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON "User"("organizationId");

-- 4. Table: PmeSession
CREATE TABLE IF NOT EXISTS "PmeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "uploadedById" TEXT,
    "provider" TEXT,
    "program" TEXT,
    "cycle" TEXT,
    "period" TEXT,
    "participantId" TEXT,
    "laboratoryName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "statusDetail" TEXT,
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "ruleVersion" TEXT,
    "aiProvider" TEXT,
    "rawExtraction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PmeSession_organizationId_status_idx" ON "PmeSession"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "PmeSession_organizationId_createdAt_idx" ON "PmeSession"("organizationId", "createdAt");

-- 5. Table: PmeFile
CREATE TABLE IF NOT EXISTS "PmeFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL UNIQUE REFERENCES "PmeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "driveFileId" TEXT,
    "driveViewUrl" TEXT,
    "driveDownloadUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "pdfClass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Table: PmeResult
CREATE TABLE IF NOT EXISTS "PmeResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL REFERENCES "PmeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "organizationId" TEXT NOT NULL,
    "parameterName" TEXT NOT NULL,
    "participantValue" DOUBLE PRECISION,
    "targetValue" DOUBLE PRECISION,
    "sdpa" DOUBLE PRECISION,
    "zScore" DOUBLE PRECISION,
    "unit" TEXT,
    "method" TEXT,
    "instrument" TEXT,
    "peerGroup" TEXT,
    "providerRemark" TEXT,
    "parameterConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "participantConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "zScoreConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourcePage" INTEGER,
    "sourceText" TEXT,
    "sourceBbox" TEXT,
    "validationStatus" TEXT NOT NULL DEFAULT 'VALID',
    "analysisStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewStatus" TEXT NOT NULL DEFAULT 'NONE',
    "issues" TEXT,
    "zStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PmeResult_sessionId_idx" ON "PmeResult"("sessionId");
CREATE INDEX IF NOT EXISTS "PmeResult_organizationId_validationStatus_idx" ON "PmeResult"("organizationId", "validationStatus");
CREATE INDEX IF NOT EXISTS "PmeResult_organizationId_zStatus_idx" ON "PmeResult"("organizationId", "zStatus");

-- 7. Table: AiAnalysis
CREATE TABLE IF NOT EXISTS "AiAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resultId" TEXT NOT NULL UNIQUE REFERENCES "PmeResult"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "interpretation" TEXT NOT NULL,
    "possibleCauses" TEXT NOT NULL,
    "investigationSteps" TEXT NOT NULL,
    "correctiveActions" TEXT NOT NULL,
    "preventiveActions" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AiAnalysis_resultId_idx" ON "AiAnalysis"("resultId");

-- 8. Table: AiUsageLog
CREATE TABLE IF NOT EXISTS "AiUsageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "pmeSessionId" TEXT REFERENCES "PmeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "processingTimeMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AiUsageLog_organizationId_createdAt_idx" ON "AiUsageLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiUsageLog_organizationId_operation_idx" ON "AiUsageLog"("organizationId", "operation");

-- 9. Table: CapaAction
CREATE TABLE IF NOT EXISTS "CapaAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "sessionId" TEXT REFERENCES "PmeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "resultId" TEXT REFERENCES "PmeResult"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "problem" TEXT NOT NULL,
    "finding" TEXT,
    "rootCause" TEXT,
    "immediateCorrection" TEXT,
    "correctiveAction" TEXT,
    "preventiveAction" TEXT,
    "pic" TEXT,
    "dueDate" TIMESTAMP(3),
    "verification" TEXT,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CapaAction_organizationId_status_idx" ON "CapaAction"("organizationId", "status");

-- 10. Table: ZscoreRule
CREATE TABLE IF NOT EXISTS "ZscoreRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "ruleVersion" TEXT NOT NULL,
    "satisfactoryLimit" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "warningLimit" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ZscoreRule_organizationId_isActive_idx" ON "ZscoreRule"("organizationId", "isActive");

-- 11. Table: AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- 12. Table: Report
CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL REFERENCES "PmeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "format" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Report_organizationId_sessionId_idx" ON "Report"("organizationId", "sessionId");

-- 13. Table: ExtractionLog
CREATE TABLE IF NOT EXISTS "ExtractionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL REFERENCES "PmeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ExtractionLog_sessionId_idx" ON "ExtractionLog"("sessionId");
