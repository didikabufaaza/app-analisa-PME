export type StatusCategory = 'Memuaskan' | 'Peringatan' | 'Kurang Memuaskan';

export interface GroupScore {
  n: number | string;
  target: number | string;
  zScore: number | string;
  kategori: string;
  keterangan: string;
}

export interface BotolEvaluation {
  botolLabel: string; // "Botol 1" | "Botol 2"
  hasilSaudara: number;
  seluruh: GroupScore;
  kelompokMetode: GroupScore;
  kelompokAlat: GroupScore;
  overallStatus: StatusCategory;
}

export interface ParameterEvaluation {
  id: string;
  no: number;
  parameterName: string;
  kodeMetode: string;
  kodeAlat: string;
  unit: string;
  sasaran: string;
  hasilPencapaianSummary: string;
  botol1: BotolEvaluation;
  botol2: BotolEvaluation;
  rencanaPerbaikan: string;
  penanggungJawab: string;
  statusOverall: StatusCategory;
  documentId?: string;
  sourceFileName?: string;
}

export interface UploadedDocumentRecord {
  id: string;
  fileName: string;
  fileSize?: number;
  uploadedAt: string;
  parameterCount: number;
  siklusInfo?: string;
}

export interface SignatoryItem {
  id: string;
  roleTitle: string; // e.g. "Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan" or "Kepala Instalasi Laboratorium"
  name: string; // e.g. "dr. Lisa Dewi, MKes"
  nipOrId: string; // e.g. "196907172001122001"
  locationAndDate?: string; // e.g. "Palembang, 14 November 2025"
  signStyle?: 'cursive' | 'plain' | 'image';
  customSignatureImage?: string; // Base64 data URL
}

export interface PmeDocumentHeader {
  judulDoc: string;
  pmeOrganizer: string;
  siklusInfo: string;
  tanggalHasil: string;
  kotaDokumen?: string;
  kodePeserta: string;
  namaPeserta: string;
  ketuaTimKerja: string;
  nipKetua: string;
  signatories?: SignatoryItem[];
  signatoryLayout?: 'single-right' | 'single-left' | 'dual' | 'triple';
}
