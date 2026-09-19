/**
 * PME Biostatistical & Outlier Engine
 * Berdasarkan ISO 13528, ISO/IEC 17043, Tukey Boxplot, dan Dixon Q-Test
 */

// Nilai kritis Dixon Q-Test (Confidence Level 95%, alpha = 0.05) untuk N = 3..25
export const DIXON_Q_TABLE_95: Record<number, number> = {
  3: 0.970,
  4: 0.829,
  5: 0.710,
  6: 0.625,
  7: 0.568,
  8: 0.526,
  9: 0.493,
  10: 0.466,
  11: 0.444,
  12: 0.426,
  13: 0.410,
  14: 0.396,
  15: 0.384,
  16: 0.374,
  17: 0.365,
  18: 0.356,
  19: 0.349,
  20: 0.342,
  21: 0.337,
  22: 0.331,
  23: 0.326,
  24: 0.321,
  25: 0.317,
};

export interface DescriptiveStats {
  n: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  sdpa: number; // ISO 13528 nIQR = IQR * 0.7413
  mad: number; // Median Absolute Deviation
  robustSd: number; // Algoritma A = MAD * 1.4826
  cvPercent: number; // (SDPA / Median) * 100
  innerLower: number; // Q1 - 1.5 * IQR
  innerUpper: number; // Q3 + 1.5 * IQR
  outerLower: number; // Q1 - 3.0 * IQR
  outerUpper: number; // Q3 + 3.0 * IQR
}

export interface DixonTestResult {
  isApplicable: boolean;
  n: number;
  qTable: number | null;
  qMin: number | null;
  qMax: number | null;
  isLowOutlier: boolean;
  isHighOutlier: boolean;
  status: string;
}

export type OutlierStatus = "NORMAL" | "OUTLIER" | "EXTREME OUTLIER";

export interface ParticipantEvaluation {
  value: number;
  zScore: number | null;
  category: "OK" | "$" | "ACTION" | "-";
  statusText: "Memuaskan" | "Peringatan" | "Tidak Memuaskan" | "-";
  biasPercent: number | null;
  cvRef: number | null;
  totalErrorPercent: number | null;
  outlierStatus: OutlierStatus;
  isPass: boolean;
}

export interface PeerGroupStats {
  n: number;
  target: number | null;
  sdpa: number | null;
  isAnalyzed: boolean; // true jika n >= 6, false jika n < 6 ("Tidak dianalisa")
}

/** Hitung median dari array numerik */
export function calculateMedian(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Hitung persentil Excel QUARTILE.INC (linear interpolation) */
export function calculatePercentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  if (arr.length === 1) return arr[0];
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/** Hitung statistik deskriptif dan robust standar ISO 13528 */
export function calculateDescriptiveStats(rawValues: number[]): DescriptiveStats | null {
  const values = rawValues.filter((v) => typeof v === "number" && !isNaN(v) && isFinite(v));
  const n = values.length;
  if (n === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;
  const median = calculateMedian(sorted);

  const q1 = calculatePercentile(sorted, 0.25);
  const q3 = calculatePercentile(sorted, 0.75);
  const iqr = Math.max(0, q3 - q1);

  // ISO 13528: SDPA didekati dengan nIQR = 0.7413 * IQR
  const sdpa = iqr * 0.7413;

  // MAD = Median(|xi - Median|)
  const absDeviations = sorted.map((v) => Math.abs(v - median));
  const mad = calculateMedian(absDeviations);
  const robustSd = mad * 1.4826;

  // CV % berbasis SDPA atau Robust SD terhadap Assigned Value
  const cvPercent = median !== 0 ? (sdpa / Math.abs(median)) * 100 : 0;

  // Tukey Boxplot Fences
  const innerLower = q1 - 1.5 * iqr;
  const innerUpper = q3 + 1.5 * iqr;
  const outerLower = q1 - 3.0 * iqr;
  const outerUpper = q3 + 3.0 * iqr;

  return {
    n,
    min,
    max,
    mean,
    median,
    q1,
    q3,
    iqr,
    sdpa: sdpa > 0 ? sdpa : robustSd > 0 ? robustSd : 0.001,
    mad,
    robustSd,
    cvPercent,
    innerLower,
    innerUpper,
    outerLower,
    outerUpper,
  };
}

/** Deteksi status outlier Tukey Boxplot */
export function getTukeyOutlierStatus(value: number, stats: DescriptiveStats): OutlierStatus {
  if (value < stats.outerLower || value > stats.outerUpper) {
    return "EXTREME OUTLIER";
  }
  if (value < stats.innerLower || value > stats.innerUpper) {
    return "OUTLIER";
  }
  return "NORMAL";
}

/** Uji Dixon Q-Test untuk mendeteksi outlier pada sampel kecil (3 <= n <= 25) */
export function runDixonQTest(rawValues: number[]): DixonTestResult {
  const values = rawValues.filter((v) => typeof v === "number" && !isNaN(v) && isFinite(v));
  const n = values.length;

  if (n < 3 || n > 25) {
    return {
      isApplicable: false,
      n,
      qTable: null,
      qMin: null,
      qMax: null,
      isLowOutlier: false,
      isHighOutlier: false,
      status: n < 3 ? "Data tidak cukup (N < 3)" : "Gunakan Metode Robust ISO 13528 (N > 25)",
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const range = sorted[n - 1] - sorted[0];

  if (range === 0) {
    return {
      isApplicable: true,
      n,
      qTable: DIXON_Q_TABLE_95[n] || 0.35,
      qMin: 0,
      qMax: 0,
      isLowOutlier: false,
      isHighOutlier: false,
      status: "Variasi nol (seluruh nilai sama)",
    };
  }

  const qTable = DIXON_Q_TABLE_95[n] || 0.35;
  const qMin = (sorted[1] - sorted[0]) / range;
  const qMax = (sorted[n - 1] - sorted[n - 2]) / range;

  const isLowOutlier = qMin > qTable;
  const isHighOutlier = qMax > qTable;

  let status = "Tidak ada outlier Dixon terdeteksi";
  if (isLowOutlier && isHighOutlier) {
    status = "Pencilan bawah (x1) dan atas (xn) terdeteksi signifikan (p < 0.05)";
  } else if (isLowOutlier) {
    status = `Pencilan bawah (nilai terendah ${sorted[0]}) terdeteksi signifikan (Q = ${qMin.toFixed(3)} > ${qTable})`;
  } else if (isHighOutlier) {
    status = `Pencilan atas (nilai tertinggi ${sorted[n - 1]}) terdeteksi signifikan (Q = ${qMax.toFixed(3)} > ${qTable})`;
  }

  return {
    isApplicable: true,
    n,
    qTable,
    qMin: Number(qMin.toFixed(4)),
    qMax: Number(qMax.toFixed(4)),
    isLowOutlier,
    isHighOutlier,
    status,
  };
}

/** Evaluasi individual Z-Score laboratorium peserta */
export function evaluateParticipantResult(
  value: number,
  target: number,
  sdpa: number,
  stats?: DescriptiveStats | null
): ParticipantEvaluation {
  if (sdpa <= 0) {
    return {
      value,
      zScore: null,
      category: "-",
      statusText: "-",
      biasPercent: null,
      cvRef: null,
      totalErrorPercent: null,
      outlierStatus: "NORMAL",
      isPass: true,
    };
  }

  const z = (value - target) / sdpa;
  const absZ = Math.abs(z);

  let category: "OK" | "$" | "ACTION" = "OK";
  let statusText: "Memuaskan" | "Peringatan" | "Tidak Memuaskan" = "Memuaskan";
  let isPass = true;

  if (absZ <= 2.0) {
    category = "OK";
    statusText = "Memuaskan";
    isPass = true;
  } else if (absZ < 3.0) {
    category = "$";
    statusText = "Peringatan";
    isPass = false;
  } else {
    category = "ACTION";
    statusText = "Tidak Memuaskan";
    isPass = false;
  }

  const biasPercent = target !== 0 ? ((value - target) / target) * 100 : 0;
  const cvRef = stats?.cvPercent ?? (target !== 0 ? (sdpa / target) * 100 : 0);
  const totalErrorPercent = Math.abs(biasPercent) + 1.65 * cvRef;

  const outlierStatus: OutlierStatus = stats
    ? getTukeyOutlierStatus(value, stats)
    : absZ >= 3.0
    ? "OUTLIER"
    : "NORMAL";

  return {
    value,
    zScore: Number(z.toFixed(2)),
    category,
    statusText,
    biasPercent: Number(biasPercent.toFixed(2)),
    cvRef: Number(cvRef.toFixed(2)),
    totalErrorPercent: Number(totalErrorPercent.toFixed(2)),
    outlierStatus,
    isPass,
  };
}

/** Hitung statistik kelompok peer (Metode atau Alat) dengan batas minimal peserta >= 6 */
export function calculatePeerGroup(
  values: number[],
  minRequired = 6
): PeerGroupStats {
  const n = values.length;
  if (n < minRequired) {
    return {
      n,
      target: null,
      sdpa: null,
      isAnalyzed: false,
    };
  }

  const stats = calculateDescriptiveStats(values);
  if (!stats) {
    return {
      n,
      target: null,
      sdpa: null,
      isAnalyzed: false,
    };
  }

  return {
    n,
    target: Number(stats.median.toFixed(2)),
    sdpa: Number(stats.sdpa.toFixed(2)),
    isAnalyzed: true,
  };
}
