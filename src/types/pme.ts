/** Shared frontend types matching the didikpme API responses. */

export type SessionStatus =
  | "UPLOADED"
  | "EXTRACTING"
  | "VALIDATING"
  | "REVIEW_REQUIRED"
  | "ANALYZING"
  | "COMPLETED"
  | "FAILED";

export type ZStatus = "SATISFACTORY" | "WARNING" | "UNSATISFACTORY";

export type IssueCode =
  | "LOW_CONFIDENCE"
  | "MISSING_Z_SCORE"
  | "MISSING_VALUE"
  | "INVALID_NUMBER"
  | "SIGN_CONFLICT"
  | "OCR_CONFLICT"
  | "MISSING_SOURCE"
  | "UNVERIFIED_SOURCE"
  | "DUPLICATE_PARAMETER";

export interface PmeFileInfo {
  id: string;
  fileName: string;
  sizeBytes: number;
  pageCount: number | null;
  pdfClass: string | null;
  driveFileId?: string | null;
  driveViewUrl?: string | null;
  driveDownloadUrl?: string | null;
}

export interface AiAnalysisData {
  interpretation: string;
  possibleCauses: { category: string; text: string }[];
  investigationSteps: string[];
  correctiveActions: string[];
  preventiveActions: string[];
  instrumentEvaluation?: string | null;
  methodEvaluation?: string | null;
  biasAnalysis?: string | null;
  provider: string;
  model: string;
  promptVersion: string;
  createdAt: string;
}

export interface PmeResultData {
  id: string;
  parameterName: string;
  participantValue: number | null;
  targetValue: number | null;
  sdpa?: number | null;
  zScore: number | null;
  unit: string | null;
  method?: string | null;
  instrument?: string | null;
  peerGroup?: string | null;
  providerRemark?: string | null;
  allParticipantsCount?: number | null;
  allParticipantsTarget?: number | null;
  allParticipantsSdpa?: number | null;
  allParticipantsZScore?: number | null;
  allParticipantsStatus?: string | null;
  methodCount?: number | null;
  methodTarget?: number | null;
  methodSdpa?: number | null;
  methodZScore?: number | null;
  methodStatus?: string | null;
  instrumentCount?: number | null;
  instrumentTarget?: number | null;
  instrumentSdpa?: number | null;
  instrumentZScore?: number | null;
  instrumentStatus?: string | null;
  parameterConfidence: number;
  participantConfidence: number;
  targetConfidence: number;
  zScoreConfidence: number;
  sourcePage: number | null;
  sourceText: string | null;
  sourceBbox: number[] | null;
  validationStatus: "VALID" | "REVIEW_REQUIRED";
  analysisStatus: "PENDING" | "DONE" | "SKIPPED";
  reviewStatus: "NONE" | "ACCEPTED" | "EDITED" | "REJECTED";
  issues: IssueCode[];
  zStatus: ZStatus | null;
  aiAnalysis: AiAnalysisData | null;
}

export interface PmeSessionDetail {
  id: string;
  provider: string | null;
  program: string | null;
  cycle: string | null;
  period: string | null;
  participantId: string | null;
  laboratoryName: string | null;
  status: SessionStatus;
  statusDetail: string | null;
  errorMessage: string | null;
  errorCode: string | null;
  ruleVersion: string | null;
  aiProvider: string | null;
  createdAt: string;
  updatedAt: string;
  file: PmeFileInfo | null;
  capaCount: number;
  processing: boolean;
}

export interface PmeSessionListItem {
  id: string;
  provider: string | null;
  program: string | null;
  cycle: string | null;
  period: string | null;
  laboratoryName: string | null;
  participantId: string | null;
  status: SessionStatus;
  statusDetail: string | null;
  errorMessage: string | null;
  errorCode: string | null;
  ruleVersion: string | null;
  aiProvider: string | null;
  createdAt: string;
  file: { fileName: string; sizeBytes: number; pageCount: number | null; pdfClass: string | null } | null;
  resultCount: number;
  capaCount: number;
}

export interface DashboardData {
  counts: {
    totalPme: number;
    totalParameter: number;
    satisfactory: number;
    warning: number;
    unsatisfactory: number;
    reviewRequired: number;
  };
  zDistribution: { range: string; label: string; count: number }[];
  parameterStatus: { name: string; value: number; key: string }[];
  trend: { id: string; name: string; avgAbsZ: number; warning: number; unsatisfactory: number }[];
  worst: { id: string; parameter: string; zScore: number; zStatus: string | null; cycle: string | null }[];
  aiConfidence: {
    average: number;
    buckets: { name: string; count: number }[];
  };
  recentSessions: {
    id: string;
    cycle: string | null;
    provider: string | null;
    program: string | null;
    status: SessionStatus;
    createdAt: string;
  }[];
}

export interface ReviewItem {
  id: string;
  sessionId: string;
  parameterName: string;
  participantValue: number | null;
  targetValue: number | null;
  sdpa?: number | null;
  zScore: number | null;
  unit: string | null;
  zStatus: ZStatus | null;
  issues: IssueCode[];
  categories: string;
  confidences: { parameter: number; participant: number; target: number; zScore: number };
  sourcePage: number | null;
  sourceText: string | null;
  reviewStatus: string;
  session: { id: string; cycle: string | null; program: string | null; provider: string | null; createdAt: string };
}

export interface CapaData {
  id: string;
  problem: string;
  finding: string | null;
  rootCause: string | null;
  immediateCorrection: string | null;
  correctiveAction: string | null;
  preventiveAction: string | null;
  pic: string | null;
  dueDate: string | null;
  verification: string | null;
  evidence: string | null;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  closedAt: string | null;
  createdAt: string;
  result: { parameterName: string; zScore: number | null; zStatus: string | null } | null;
  session: { id: string; cycle: string | null; program: string | null } | null;
}

export interface ZscoreRuleData {
  id: string;
  ruleVersion: string;
  satisfactoryLimit: number;
  warningLimit: number;
  effectiveDate: string;
  isActive: boolean;
}

export interface AiUsageData {
  summary: {
    requests: number;
    successfulRequests: number;
    limit: number;
    usagePct: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    errors: number;
    estimatedCost: number;
    alerts: string[];
  };
  byOperation: { operation: string; requests: number; totalTokens: number; processingTimeMs: number }[];
  recentLogs: {
    id: string;
    provider: string;
    model: string;
    operation: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    processingTimeMs: number;
    status: string;
    errorMessage: string | null;
    createdAt: string;
  }[];
}

export interface AiConfigData {
  provider: string;
  activeProvider: string;
  model: string;
  mode: string;
  apiKeyMasked: string;
  apiStatus: string;
  apiStatusDetail: string | null;
  fallbackStatus: string;
  fallbackDetail: string | null;
  lastSuccessfulRequest: { createdAt: string; provider: string; model: string } | null;
  monthlyRequests: number;
  monthlyTokenUsage: { input: number; output: number };
  estimatedCost: number;
}

export interface AuditLogData {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  user: { name: string; email: string } | null;
  createdAt: string;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  menuAccess?: string[] | null;
  organization: { id: string; name: string; plan: string; monthlyAiLimit?: number };
  aiUsage?: { used: number; limit: number };
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  menuAccess: string[];
  createdAt: string;
  organizationId: string;
  organization?: { id: string; name: string; slug: string; plan: string };
}

export interface TenantOption {
  id: string;
  name: string;
  slug: string;
  plan: string;
  monthlyAiLimit: number;
  _count?: { users: number; pmeSessions: number };
}

export interface ReportItemData {
  id: string;
  parameterName: string;
  participantValue: number | null;
  targetValue: number | null;
  sdpa?: number | null;
  zScore: number | null;
  unit: string | null;
  zStatus: string | null;
  validationStatus: string;
  method?: string | null;
  instrument?: string | null;
  instrumentTarget?: number | null;
  instrumentZScore?: number | null;
  instrumentStatus?: string | null;
  methodTarget?: number | null;
  methodZScore?: number | null;
  methodStatus?: string | null;
  allParticipantsTarget?: number | null;
  allParticipantsZScore?: number | null;
  allParticipantsStatus?: string | null;
  aiAnalysis?: {
    interpretation: string;
    possibleCauses: string;
    investigationSteps: string;
    correctiveActions: string;
    preventiveActions: string;
    provider: string;
    model: string;
  } | null;
  capaActions?: {
    id: string;
    status: string;
    pic: string | null;
    dueDate: string | null;
  }[];
  session: {
    id: string;
    program: string | null;
    cycle: string | null;
    period: string | null;
    provider: string | null;
    laboratoryName: string | null;
    createdAt: string;
    ruleVersion: string | null;
  };
}

