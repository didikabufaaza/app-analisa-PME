export type Language = "id" | "en";

export interface I18nDictionary {
  // Navigation & Shell
  dashboard: string;
  sessions: string;
  sessionDetail: string;
  reports: string;
  reportsFullTitle: string;
  review: string;
  reviewFullTitle: string;
  capa: string;
  capaFullTitle: string;
  letterhead: string;
  letterheadFullTitle: string;
  settings: string;
  auditLogs: string;
  userSettings: string;
  userSettingsFullTitle: string;
  pmeManagement: string;
  pmeRegistration: string;
  pmePackages: string;
  pmeInput: string;
  pmeInfo: string;
  masterData: string;
  pmeReports: string;
  pmeReportsParticipant: string;

  // Shell Brand & Topbar
  brandSubtitle: string;
  monthlyQuota: string;
  evaluations: string;
  logoutApp: string;
  logout: string;
  systemSubtitle: string;
  viewAs: string;
  allOrgsGlobal: string;
  ownOrgGroup: string;
  myOrg: string;
  otherOrgsGroup: string;
  viewOnly: string;
  superadmin: string;
  systemSettings: string;
  footerQuality: string;
  footerVerified: string;
  languageSelect: string;

  // Common UI Actions & Filters
  filter: string;
  resetFilter: string;
  searchPlaceholder: string;
  quickSearch: string;
  save: string;
  cancel: string;
  close: string;
  edit: string;
  delete: string;
  downloadPdf: string;
  print: string;
  exportExcel: string;
  all: string;
  status: string;
  action: string;
  loading: string;
  success: string;
  failed: string;
  refresh: string;

  // PME Cycles & Filters
  pmeCycle: string;
  selectCycle: string;
  periodStage: string;
  allPeriods: string;
  packageCategory: string;
  allCategories: string;
  qualityStatus: string;
  allStatuses: string;
  participantLab: string;
  allLabs: string;

  // Evaluation Categories
  satisfactory: string;
  warning: string;
  unsatisfactory: string;
  notExamined: string;

  // Analysis & Model 1 Evaluation Sheet
  analyzeButton: string;
  remainingQuota: string;
  quotaWarning: string;
  analysisTitle: string;
  analysisSubtitle: string;
  confidentialWatermark: string;
  officialReport: string;
  labName: string;
  participantCode: string;
  sampleLevel: string;
  analysisDate: string;
  passRate: string;
  clinicalSummaryTitle: string;
  biasObservationsTitle: string;
  rootCauseMatrixTitle: string;
  category6M: string;
  investigationFinding: string;
  recommendedAction: string;
  correctiveActionsTitle: string;
  preventiveActionsTitle: string;
  authorizedSignerTitle: string;
  approvedBy: string;
  qualityOfficer: string;
  idNumber: string;

  // Table Columns (Model 1 & Recap)
  colNo: string;
  colParameter: string;
  colUnit: string;
  colLabResult: string;
  colConsensusTarget: string;
  colSdpa: string;
  colZscore: string;
  colEvaluation: string;
  colBias: string;
  colMethod: string;
  colInstrument: string;
  colReagent: string;
  colParticipants: string;

  // Fishbone 6M Categories
  catMan: string;
  catMachine: string;
  catMethod: string;
  catMaterial: string;
  catMilieu: string;
  catMeasurement: string;
}

export const DICTIONARY: Record<Language, I18nDictionary> = {
  id: {
    dashboard: "Dashboard",
    sessions: "Sesi PME",
    sessionDetail: "Detail Sesi PME",
    reports: "Laporan",
    reportsFullTitle: "Laporan Lengkap & Evaluasi Mutu",
    review: "Review Center",
    reviewFullTitle: "Pusat Verifikasi Data",
    capa: "CAPA",
    capaFullTitle: "Tindakan Korektif & Preventif (CAPA)",
    letterhead: "Kop Surat",
    letterheadFullTitle: "Pengaturan Kop Surat Laboratorium",
    settings: "Pengaturan",
    auditLogs: "Log Audit",
    userSettings: "Pengaturan User",
    userSettingsFullTitle: "Pengaturan Pengguna & Hak Akses",
    pmeManagement: "Manajemen Data PME",
    pmeRegistration: "1. Pendaftaran PME",
    pmePackages: "2. Pemilihan Paket PME",
    pmeInput: "3. Input Hasil PME",
    pmeInfo: "4. Informasi & Siklus PME",
    masterData: "5. Master Data",
    pmeReports: "Laporan Hasil PME",
    pmeReportsParticipant: "Lembar Hasil Evaluasi PME",

    brandSubtitle: "Evaluasi Z-Score & PME",
    monthlyQuota: "Kapasitas Evaluasi Bulanan",
    evaluations: "evaluasi",
    logoutApp: "Keluar Aplikasi",
    logout: "Keluar",
    systemSubtitle: "Sistem Evaluasi Z-Score & Penjaminan Mutu Eksternal Laboratorium",
    viewAs: "Lihat Sebagai:",
    allOrgsGlobal: "🌐 Semua Organisasi (Global View)",
    ownOrgGroup: "Database Akun Sendiri",
    myOrg: "🏢 Organisasi Saya",
    otherOrgsGroup: "Organisasi Lain",
    viewOnly: "Lihat Saja",
    superadmin: "Superadmin",
    systemSettings: "Pengaturan Sistem",
    footerQuality: "di-dismartPME — Evaluasi Z-Score & PME Laboratorium · Standar ISO 15189",
    footerVerified: "Evaluasi akhir Z-score diverifikasi sesuai standar mutu laboratorium.",
    languageSelect: "Pilih Bahasa",

    filter: "Filter",
    resetFilter: "Reset Filter",
    searchPlaceholder: "Cari data...",
    quickSearch: "Pencarian Cepat",
    save: "Simpan",
    cancel: "Batal",
    close: "Tutup",
    edit: "Ubah",
    delete: "Hapus",
    downloadPdf: "Unduh PDF",
    print: "Cetak",
    exportExcel: "Ekspor Excel",
    all: "Semua",
    status: "Status",
    action: "Aksi",
    loading: "Memuat...",
    success: "Berhasil",
    failed: "Gagal",
    refresh: "Segarkan",

    pmeCycle: "Siklus PME",
    selectCycle: "Pilih Siklus",
    periodStage: "Periode / Tahap",
    allPeriods: "Semua Periode",
    packageCategory: "Kategori Paket",
    allCategories: "Semua Kategori",
    qualityStatus: "Status Evaluasi Mutu",
    allStatuses: "Semua Status Kinerja",
    participantLab: "Laboratorium Peserta",
    allLabs: "Semua Laboratorium",

    satisfactory: "Memuaskan (|Z| ≤ 2.0)",
    warning: "Peringatan (2.0 < |Z| < 3.0)",
    unsatisfactory: "Tidak Memuaskan (|Z| ≥ 3.0)",
    notExamined: "Parameter Tidak Diperiksa / Kosong",

    analyzeButton: "Analisa Hasil PME",
    remainingQuota: "Sisa Kuota Analisis",
    quotaWarning: "Kuota analisis organisasi Anda telah habis.",
    analysisTitle: "Laporan Hasil Analisis Evaluasi Mutu PME (Model 1)",
    analysisSubtitle: "Berdasarkan Standar ISO 13528 & ISO 15189 dengan Matriks Investigasi Akar Masalah 6M (Ishikawa)",
    confidentialWatermark: "RAHASIA",
    officialReport: "LAPORAN EVALUASI RESMI",
    labName: "Nama Laboratorium",
    participantCode: "Kode Peserta",
    sampleLevel: "Sampel / Level",
    analysisDate: "Tanggal Analisis",
    passRate: "Tingkat Kelulusan (Pass Rate)",
    clinicalSummaryTitle: "Ringkasan Kinerja & Evaluasi Klinis",
    biasObservationsTitle: "Observasi Bias & Deviasi Klinis",
    rootCauseMatrixTitle: "Matriks Investigasi Akar Masalah 6M (Fishbone / Diagram Ishikawa)",
    category6M: "Kategori 6M",
    investigationFinding: "Temuan Investigasi Klinis",
    recommendedAction: "Rekomendasi Tindakan",
    correctiveActionsTitle: "Rekomendasi Tindakan Korektif (Corrective Actions)",
    preventiveActionsTitle: "Rekomendasi Tindakan Pencegahan (Preventive Actions)",
    authorizedSignerTitle: "Pengesahan Pejabat Berwenang",
    approvedBy: "Mengetahui & Menyetujui,",
    qualityOfficer: "Penanggung Jawab Mutu Laboratorium",
    idNumber: "NIP.",

    colNo: "No",
    colParameter: "Parameter Uji",
    colUnit: "Satuan",
    colLabResult: "Hasil Lab",
    colConsensusTarget: "Target Konsensus",
    colSdpa: "SDPA",
    colZscore: "Z-Score",
    colEvaluation: "Evaluasi Mutu",
    colBias: "Bias (%)",
    colMethod: "Metode",
    colInstrument: "Alat / Instrumen",
    colReagent: "Reagen",
    colParticipants: "Peserta",

    catMan: "Man (SDM / Analis)",
    catMachine: "Machine (Instrumen / Alat)",
    catMethod: "Method (Metode Pemeriksaan)",
    catMaterial: "Material (Reagen & Kontrol)",
    catMilieu: "Milieu (Lingkungan Laboratorium)",
    catMeasurement: "Measurement (Pengukuran & Data)",
  },

  en: {
    dashboard: "Dashboard",
    sessions: "PME Sessions",
    sessionDetail: "PME Session Detail",
    reports: "Reports",
    reportsFullTitle: "Comprehensive Reports & Quality Evaluation",
    review: "Review Center",
    reviewFullTitle: "Data Verification Center",
    capa: "CAPA",
    capaFullTitle: "Corrective & Preventive Action (CAPA)",
    letterhead: "Letterhead",
    letterheadFullTitle: "Laboratory Letterhead Settings",
    settings: "Settings",
    auditLogs: "Audit Logs",
    userSettings: "User Settings",
    userSettingsFullTitle: "User Management & Access Control",
    pmeManagement: "PME Data Management",
    pmeRegistration: "1. PME Registration",
    pmePackages: "2. Package Selection",
    pmeInput: "3. Results Entry",
    pmeInfo: "4. Information & Cycles",
    masterData: "5. Master Data",
    pmeReports: "PME Results Report",
    pmeReportsParticipant: "PME Quality Evaluation Sheet",

    brandSubtitle: "Z-Score & PME Evaluation",
    monthlyQuota: "Monthly Evaluation Capacity",
    evaluations: "evaluations",
    logoutApp: "Sign Out",
    logout: "Sign Out",
    systemSubtitle: "Laboratory Z-Score Evaluation & External Quality Assurance System (ISO 15189)",
    viewAs: "View As:",
    allOrgsGlobal: "🌐 All Organizations (Global View)",
    ownOrgGroup: "Current Account Database",
    myOrg: "🏢 My Organization",
    otherOrgsGroup: "Other Organizations",
    viewOnly: "View Only",
    superadmin: "Superadmin",
    systemSettings: "System Settings",
    footerQuality: "di-dismartPME — Laboratory Z-Score & PME Evaluation · ISO 15189 Standards",
    footerVerified: "Final Z-score evaluation verified according to clinical quality standards.",
    languageSelect: "Language",

    filter: "Filter",
    resetFilter: "Reset Filters",
    searchPlaceholder: "Search data...",
    quickSearch: "Quick Search",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    edit: "Edit",
    delete: "Delete",
    downloadPdf: "Download PDF",
    print: "Print",
    exportExcel: "Export Excel",
    all: "All",
    status: "Status",
    action: "Action",
    loading: "Loading...",
    success: "Success",
    failed: "Failed",
    refresh: "Refresh",

    pmeCycle: "PME Cycle",
    selectCycle: "Select Cycle",
    periodStage: "Period / Stage",
    allPeriods: "All Periods",
    packageCategory: "Package Category",
    allCategories: "All Categories",
    qualityStatus: "Quality Status",
    allStatuses: "All Statuses",
    participantLab: "Participant Laboratory",
    allLabs: "All Laboratories",

    satisfactory: "Satisfactory (|Z| ≤ 2.0)",
    warning: "Warning (2.0 < |Z| < 3.0)",
    unsatisfactory: "Unsatisfactory (|Z| ≥ 3.0)",
    notExamined: "Not Examined / Empty Parameter",

    analyzeButton: "Analyze PME Results",
    remainingQuota: "Remaining Analysis Quota",
    quotaWarning: "Your organization's analysis quota has been depleted.",
    analysisTitle: "PME Quality Evaluation Analysis Report (Model 1)",
    analysisSubtitle: "Compliant with ISO 13528 & ISO 15189 Standards with 6M Root Cause Matrix (Ishikawa)",
    confidentialWatermark: "CONFIDENTIAL",
    officialReport: "OFFICIAL EVALUATION REPORT",
    labName: "Laboratory Name",
    participantCode: "Participant Code",
    sampleLevel: "Sample / Level",
    analysisDate: "Analysis Date",
    passRate: "Passing Rate (Pass Rate)",
    clinicalSummaryTitle: "Clinical Performance Summary & Evaluation",
    biasObservationsTitle: "Bias Observations & Clinical Deviations",
    rootCauseMatrixTitle: "6M Root Cause Investigation Matrix (Fishbone / Ishikawa Diagram)",
    category6M: "6M Category",
    investigationFinding: "Investigation Findings",
    recommendedAction: "Recommended Action",
    correctiveActionsTitle: "Recommended Corrective Actions (CAPA)",
    preventiveActionsTitle: "Recommended Preventive Actions (CAPA)",
    authorizedSignerTitle: "Official Certification & Approval",
    approvedBy: "Acknowledged & Approved by,",
    qualityOfficer: "Quality Assurance Officer",
    idNumber: "ID / NIP.",

    colNo: "No",
    colParameter: "Test Parameter",
    colUnit: "Unit",
    colLabResult: "Lab Result",
    colConsensusTarget: "Consensus Target",
    colSdpa: "SDPA",
    colZscore: "Z-Score",
    colEvaluation: "Quality Evaluation",
    colBias: "Bias (%)",
    colMethod: "Method",
    colInstrument: "Instrument",
    colReagent: "Reagent",
    colParticipants: "Participants",

    catMan: "Man (Human Resources / Analyst)",
    catMachine: "Machine (Instrument / Equipment)",
    catMethod: "Method (Examination Method)",
    catMaterial: "Material (Reagents & Controls)",
    catMilieu: "Milieu (Laboratory Environment)",
    catMeasurement: "Measurement (Measurement & Data)",
  },
};

/**
 * Returns translated string for a given key in current locale
 */
export function t(key: keyof I18nDictionary, lang: Language = "id"): string {
  return DICTIONARY[lang]?.[key] ?? DICTIONARY.id[key] ?? key;
}

/**
 * Translates an evaluation status text (e.g. "Memuaskan") to the target language
 */
export function translateEvaluationStatus(status: string | null | undefined, lang: Language = "id"): string {
  if (!status) return "-";
  const s = status.trim().toLowerCase();
  if (lang === "en") {
    if (s.includes("memuaskan") && !s.includes("tidak")) return "Satisfactory";
    if (s.includes("peringatan")) return "Warning";
    if (s.includes("tidak memuaskan")) return "Unsatisfactory";
    if (s.includes("belum") || s.includes("tidak diperiksa") || s.includes("kosong")) return "Not Examined";
    return status;
  } else {
    if (s === "satisfactory") return "Memuaskan";
    if (s === "warning" || s === "questionable") return "Peringatan";
    if (s === "unsatisfactory") return "Tidak Memuaskan";
    if (s === "not examined" || s === "not_examined") return "Tidak Diperiksa";
    return status;
  }
}

/**
 * Translates a complete analysis object into English or Indonesian on the fly.
 * Allows instant, quota-free language toggling for analysis reports!
 */
export function formatAnalysisForLanguage(analysis: any, lang: Language = "id"): any {
  if (!analysis) return analysis;
  if (lang === "id") return analysis;

  // Build English localized version
  const sampleLabelEn =
    analysis.sample === "Sampel 2"
      ? "Sample 2 (Level 2 / Pathological)"
      : "Sample 1 (Level 1 / Normal)";

  const clinicalSummaryEn = `Based on ISO 13528 biostatistical evaluation for ${analysis.cycle || "Cycle"} (${sampleLabelEn}), laboratory ${
    analysis.participantName || "Participant"
  } examined ${analysis.totalParameters || 0} parameters. Analytical performance indicates: ${
    analysis.satisfactoryCount || 0
  } Satisfactory parameters (|Z| ≤ 2.0), ${analysis.warningCount || 0} Warning parameters (2.0 < |Z| < 3.0), and ${
    analysis.unsatisfactoryCount || 0
  } Unsatisfactory parameters (|Z| ≥ 3.0).`;

  const biasObservationsEn: string[] = [];
  if (analysis.unsatisfactoryCount > 0 && Array.isArray(analysis.evaluationFindings)) {
    const unsat = analysis.evaluationFindings.filter(
      (f: any) =>
        f.statusText === "Tidak Memuaskan" ||
        f.category === "UNSATISFACTORY" ||
        Math.abs(Number(f.zScore)) >= 3.0
    );
    unsat.forEach((u: any) => {
      const dir = Number(u.zScore) > 0 ? "positive (overestimation)" : "negative (underestimation)";
      biasObservationsEn.push(
        `Parameter ${u.parameterName}: Significant deviation with Z-Score ${
          Number(u.zScore) > 0 ? "+" : ""
        }${Number(u.zScore).toFixed(2)} (${
          u.biasPercent !== null && u.biasPercent !== undefined
            ? `${Number(u.biasPercent) > 0 ? "+" : ""}${Number(u.biasPercent)}%`
            : ""
        } ${dir} bias relative to consensus target ${u.target} ${u.unit}). Indicates potential calibration drift or reagent mismatch (${
          u.reagentName || "-"
        }) on instrument (${u.instrumentCode || "-"}).`
      );
    });
  }
  if (analysis.warningCount > 0 && Array.isArray(analysis.evaluationFindings)) {
    const warns = analysis.evaluationFindings.filter(
      (f: any) =>
        f.statusText === "Peringatan" ||
        f.category === "WARNING" ||
        (Math.abs(Number(f.zScore)) > 2.0 && Math.abs(Number(f.zScore)) < 3.0)
    );
    warns.forEach((w: any) => {
      biasObservationsEn.push(
        `Parameter ${w.parameterName}: Z-Score is at the warning threshold (${
          Number(w.zScore) > 0 ? "+" : ""
        }${Number(w.zScore).toFixed(2)}). Requires daily monitoring of internal quality control curves (Westgard Multirule).`
      );
    });
  }
  if (analysis.unsatisfactoryCount === 0 && analysis.warningCount === 0) {
    biasObservationsEn.push(
      "All analyte parameters fall within acceptable analytical variation (|Z| ≤ 2.0) with no significant systematic bias identified against the peer consensus group."
    );
  }

  // English 6M Fishbone
  const fishboneEn = [
    {
      category: "Man (Human Resources / Analyst)",
      finding:
        analysis.unsatisfactoryCount > 0
          ? "Potential procedural variation in sample reconstitution, micro-pipetting technique, or reagent vortexing prior to aspiration."
          : "Analyst competence in sample handling, pipetting accuracy, and strict SOP adherence is well maintained.",
      action: "Review precision micro-pipetting SOPs and verify working reagent preparation guidelines.",
    },
    {
      category: "Machine (Instrument / Equipment)",
      finding:
        analysis.unsatisfactoryCount > 0
          ? "Deviations detected on instrument-dependent analytes. Cuvette cleanliness, photometer lamp intensity, and incubation chamber temperature stability require inspection."
          : "Instrument optical linearity, detector response, and photometer/electrode temperature modules are in optimal condition.",
      action: "Perform scheduled maintenance (cuvette checks, probe degreasing) and verify multi-point calibration curves.",
    },
    {
      category: "Method (Examination Method)",
      finding:
        "Analytical method principles align with manufacturer recommendations and national consensus quality standards.",
      action: "Ensure reaction parameters (incubation time, wavelength filter, conversion factors) strictly match kit package inserts.",
    },
    {
      category: "Material (Reagents & Controls)",
      finding:
        analysis.unsatisfactoryCount > 0
          ? "Evaluate stability of active reagent lots, on-board expiration duration, and continuous cold chain storage (2-8°C)."
          : "Reagent lot integrity and PME control material stability preserved without evidence of degradation or contamination.",
      action: "Conduct lot-to-lot verification before introducing new reagent batches and monitor on-board stability limits.",
    },
    {
      category: "Milieu (Laboratory Environment)",
      finding:
        "Ambient room temperature and electrical mains stability (UPS voltage regulation) directly affect analytical reproducibility.",
      action: "Maintain laboratory ambient temperature at 20-25°C and record daily reagent refrigeration temperature logs.",
    },
    {
      category: "Measurement (Measurement & Data)",
      finding:
        "Verify decimal precision and eliminate manual transcription discrepancies from analyzer display to PME reporting forms.",
      action: "Enforce dual-person verification protocol (double-check) prior to final proficiency testing data submission.",
    },
  ];

  // English Corrective & Preventive Actions
  const correctiveActionsEn =
    analysis.unsatisfactoryCount > 0
      ? [
          `Re-run PME control material with fresh reagents and calibrators for deviant parameters.`,
          "Inspect calibration curves (zero baseline, slope, and intercept) on the affected clinical chemistry/hematology analyzer.",
          "Execute probe and cuvette washing cycles to rule out reagent carryover and fluidic contamination.",
          "Document non-conformance and formulate an internal CAPA investigation report conforming to ISO 15189 accreditation standards.",
        ]
      : [
          "Maintain analytical precision and accuracy through diligent execution of daily internal quality control (IQC).",
          "Adhere to manufacturer-recommended preventative maintenance and calibration schedules.",
        ];

  const preventiveActionsEn = [
    "Conduct regular internal audits for laboratory testing standard operating procedure (SOP) compliance.",
    "Implement Westgard multirules (1-3s, 2-2s, R-4s, 4-1s) on daily Levey-Jennings quality control charts.",
    "Ensure periodic verification and calibration of micropipettes, automated dispensers, and temperature sensors.",
  ];

  // Translated findings
  const evaluationFindingsEn = Array.isArray(analysis.evaluationFindings)
    ? analysis.evaluationFindings.map((f: any) => ({
        ...f,
        statusText: translateEvaluationStatus(f.statusText, "en"),
      }))
    : [];

  return {
    ...analysis,
    sampleLabel: sampleLabelEn,
    clinicalSummary: clinicalSummaryEn,
    biasObservations: biasObservationsEn,
    fishbone: fishboneEn,
    correctiveActions: correctiveActionsEn,
    preventiveActions: preventiveActionsEn,
    evaluationFindings: evaluationFindingsEn,
  };
}
