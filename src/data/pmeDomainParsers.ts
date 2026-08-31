import { PmeDocumentHeader, ParameterEvaluation } from '../types';

// Helper to determine status from zScore
export function getStatusFromZScore(z: number): { kategori: string; keterangan: 'Memuaskan' | 'Peringatan' | 'Kurang Memuaskan' } {
  const absZ = Math.abs(z);
  if (absZ <= 2.0) {
    return { kategori: 'OK', keterangan: 'Memuaskan' };
  } else if (absZ <= 3.0) {
    return { kategori: '$', keterangan: 'Peringatan' };
  } else {
    return { kategori: '$$', keterangan: 'Kurang Memuaskan' };
  }
}

// Preset datasets for various Laboratory Specialties
export const hemostasisPreset = {
  header: {
    judulDoc: 'EVALUASI PROGRAM PEMANTAUAN MUTU EKSTERNAL BIDANG HEMOSTASIS TAHUN 2025',
    pmeOrganizer: 'BBLK Palembang (Labkesmas Palembang I)',
    siklusInfo: 'PARAMETER HEMOSTASIS / KOAGULASI BOTOL 1 & BOTOL 2 SIKLUS 2 2025',
    tanggalHasil: '18 November 2025',
    kodePeserta: '07-01-02835',
    namaPeserta: 'RSUD OKU Timur',
    ketuaTimKerja: 'dr. Lisa Dewi, MKes',
    nipKetua: '196907172001122001',
  } as PmeDocumentHeader,
  parameters: [
    {
      id: 'pt',
      no: 1,
      parameterName: 'PT (Prothrombin Time / Masa Protrombin)',
      kodeMetode: '12',
      kodeAlat: '401201',
      unit: 'detik',
      sasaran: 'Tercapainya akurasi dan presisi hasil PT Botol 1 & Botol 2 dengan nilai Z-Score |Z| ≤ 2.0 (Kategori Memuaskan).',
      hasilPencapaianSummary: 'Botol 1: Hasil 12.5 detik (Target 12.30, Z=0.35 [Memuaskan]) | Botol 2: Hasil 24.8 detik (Target 24.20, Z=0.42 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1 (Normal)',
        hasilSaudara: 12.5,
        seluruh: { n: 125, target: 12.30, zScore: 0.35, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 52, target: 12.40, zScore: 0.28, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 16, target: 12.35, zScore: 0.30, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Patologis/Memanjang)',
        hasilSaudara: 24.8,
        seluruh: { n: 125, target: 24.20, zScore: 0.42, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 52, target: 24.10, zScore: 0.45, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 16, target: 24.30, zScore: 0.38, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan stabilitas analitik hemostasis: pantau suhu inkubasi 37°C ± 0.5°C, rekonstitusi reagen tromboplastin dengan akuabides murni, dan lakukan PMI harian 2 level.',
      penanggungJawab: 'ATLM Hemostasis & dr. Sp.PK',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'aptt',
      no: 2,
      parameterName: 'APTT (Masa Tromboplastin Parsial Teraktivasi)',
      kodeMetode: '15',
      kodeAlat: '401201',
      unit: 'detik',
      sasaran: 'Tercapainya akurasi dan presisi hasil pemeriksaan APTT Botol 1 & Botol 2 dengan nilai Z-Score |Z| ≤ 2.0 (Kategori Memuaskan).',
      hasilPencapaianSummary: 'Botol 1: Hasil 31.2 detik (Target 30.80, Z=0.28 [Memuaskan]) | Botol 2: Hasil 58.4 detik (Target 57.60, Z=0.39 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1 (Normal)',
        hasilSaudara: 31.2,
        seluruh: { n: 125, target: 30.80, zScore: 0.28, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 48, target: 30.90, zScore: 0.22, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 16, target: 30.75, zScore: 0.31, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Patologis/Memanjang)',
        hasilSaudara: 58.4,
        seluruh: { n: 125, target: 57.60, zScore: 0.39, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 48, target: 57.20, zScore: 0.48, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 16, target: 57.90, zScore: 0.25, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan akurasi metode opto-mekanikal APTT. Pastikan larutan kalsium klorida (CaCl2 0.025M) tidak kedaluwarsa dan lakukan pencatatan waktu inkubasi aktivator secara presisi.',
      penanggungJawab: 'ATLM Hemostasis & PJ Teknis',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'inr',
      no: 3,
      parameterName: 'INR (International Normalized Ratio)',
      kodeMetode: '01',
      kodeAlat: '401201',
      unit: 'ratio',
      sasaran: 'Tercapainya akurasi rasio INR Botol 1 & 2 dengan nilai Z-Score |Z| ≤ 2.0 (Kategori Memuaskan).',
      hasilPencapaianSummary: 'Botol 1: Hasil 1.02 (Target 1.00, Z=0.20 [Memuaskan]) | Botol 2: Hasil 2.15 (Target 2.10, Z=0.33 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1 (Normal)',
        hasilSaudara: 1.02,
        seluruh: { n: 125, target: 1.00, zScore: 0.20, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 52, target: 1.01, zScore: 0.10, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 16, target: 1.00, zScore: 0.18, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Terapeutik/Tinggi)',
        hasilSaudara: 2.15,
        seluruh: { n: 125, target: 2.10, zScore: 0.33, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 52, target: 2.08, zScore: 0.45, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 16, target: 2.12, zScore: 0.22, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pastikan nilai ISI (International Sensitivity Index) dan MNPT (Mean Normal Prothrombin Time) diinput dengan tepat setiap penggantian lot reagen tromboplastin.',
      penanggungJawab: 'ATLM Hemostasis',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'fibrinogen',
      no: 4,
      parameterName: 'Fibrinogen',
      kodeMetode: '21',
      kodeAlat: '401201',
      unit: 'mg/dL',
      sasaran: 'Tercapainya akurasi kadar Fibrinogen metode Clauss Botol 1 & 2 dengan nilai Z-Score |Z| ≤ 2.0.',
      hasilPencapaianSummary: 'Botol 1: Hasil 285 mg/dL (Target 280.0, Z=0.25 [Memuaskan]) | Botol 2: Hasil 145 mg/dL (Target 140.0, Z=0.36 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1 (Normal)',
        hasilSaudara: 285,
        seluruh: { n: 110, target: 280.0, zScore: 0.25, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 42, target: 282.0, zScore: 0.18, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 14, target: 279.0, zScore: 0.31, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Kadar Rendah)',
        hasilSaudara: 145,
        seluruh: { n: 110, target: 140.0, zScore: 0.36, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 42, target: 139.0, zScore: 0.41, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 14, target: 142.0, zScore: 0.24, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan kurva standar Fibrinogen metode Clauss. Pastikan buffer pengencer Owren/Veronal disimpan sesuai suhu rekomendasi pabrik.',
      penanggungJawab: 'ATLM Hemostasis',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'tt',
      no: 5,
      parameterName: 'TT (Thrombin Time / Masa Trombin)',
      kodeMetode: '31',
      kodeAlat: '401201',
      unit: 'detik',
      sasaran: 'Tercapainya akurasi hasil Masa Trombin Botol 1 & 2 dengan nilai Z-Score |Z| ≤ 2.0 (Kategori Memuaskan).',
      hasilPencapaianSummary: 'Botol 1: Hasil 15.2 detik (Target 15.00, Z=0.18 [Memuaskan]) | Botol 2: Hasil 22.6 detik (Target 22.10, Z=0.31 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1 (Normal)',
        hasilSaudara: 15.2,
        seluruh: { n: 95, target: 15.00, zScore: 0.18, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 36, target: 14.90, zScore: 0.25, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 12, target: 15.10, zScore: 0.11, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Patologis/Memanjang)',
        hasilSaudara: 22.6,
        seluruh: { n: 95, target: 22.10, zScore: 0.31, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 36, target: 21.80, zScore: 0.45, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 12, target: 22.30, zScore: 0.20, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan hasil memuaskan. Reagen trombin harus selalu didinginkan selama pengujian untuk mencegah denaturasi enzim trombin.',
      penanggungJawab: 'ATLM Hemostasis',
      statusOverall: 'Memuaskan',
    },
  ] as ParameterEvaluation[],
};

export const kimiaKlinikPreset = {
  header: {
    judulDoc: 'EVALUASI PROGRAM PEMANTAUAN MUTU EKSTERNAL BIDANG KIMIA KLINIK TAHUN 2025',
    pmeOrganizer: 'BBLK Palembang (Labkesmas Palembang I)',
    siklusInfo: 'PARAMETER KIMIA KLINIK BOTOL 1 & BOTOL 2 SIKLUS 2 2025',
    tanggalHasil: '14 November 2025',
    kodePeserta: '07-01-02835',
    namaPeserta: 'RSUD OKU Timur',
    ketuaTimKerja: 'dr. Lisa Dewi, MKes',
    nipKetua: '196907172001122001',
  } as PmeDocumentHeader,
  parameters: [
    {
      id: 'glu',
      no: 1,
      parameterName: 'Glukosa Darah Sewaktu (GDS)',
      kodeMetode: '01',
      kodeAlat: '201102',
      unit: 'mg/dL',
      sasaran: 'Tercapainya akurasi glukosa darah Botol 1 & 2 dengan nilai |Z| ≤ 2.0 (Memuaskan).',
      hasilPencapaianSummary: 'Botol 1: Hasil 95 mg/dL (Target 94.20, Z=0.18 [Memuaskan]) | Botol 2: Hasil 240 mg/dL (Target 238.10, Z=0.22 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1 (Normal)',
        hasilSaudara: 95,
        seluruh: { n: 310, target: 94.20, zScore: 0.18, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 120, target: 94.00, zScore: 0.20, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 25, target: 94.50, zScore: 0.12, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Tinggi/Diabetes)',
        hasilSaudara: 240,
        seluruh: { n: 310, target: 238.10, zScore: 0.22, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 120, target: 237.90, zScore: 0.25, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 25, target: 238.50, zScore: 0.18, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan akurasi metode GOD-PAP. Lanjutkan pemantauan mutu internal (PMI) harian 2 level dan kalibrasi berkala photometer.',
      penanggungJawab: 'ATLM Kimia Klinik',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'sgot',
      no: 2,
      parameterName: 'SGOT / AST',
      kodeMetode: '08',
      kodeAlat: '201102',
      unit: 'U/L',
      sasaran: 'Tercapainya akurasi enzim transaminase SGOT Botol 1 & 2 dengan nilai |Z| ≤ 2.0 (Kategori Memuaskan).',
      hasilPencapaianSummary: 'Botol 1: Hasil 28 U/L (Target 27.50, Z=0.22 [Memuaskan]) | Botol 2: Hasil 115 U/L (Target 112.00, Z=0.38 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1 (Normal)',
        hasilSaudara: 28,
        seluruh: { n: 295, target: 27.50, zScore: 0.22, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 110, target: 27.40, zScore: 0.25, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 24, target: 27.80, zScore: 0.12, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Tinggi/Hepatopati)',
        hasilSaudara: 115,
        seluruh: { n: 295, target: 112.00, zScore: 0.38, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 110, target: 111.50, zScore: 0.42, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 24, target: 112.50, zScore: 0.31, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan metode IFCC tanpa piridoksal fosfat. Pastikan kestabilan suhu reaksi 37°C pada kuvet kimia.',
      penanggungJawab: 'ATLM Kimia Klinik',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'sgpt',
      no: 3,
      parameterName: 'SGPT / ALT',
      kodeMetode: '09',
      kodeAlat: '201102',
      unit: 'U/L',
      sasaran: 'Tercapainya akurasi enzim SGPT Botol 1 & 2 dengan nilai |Z| ≤ 2.0 (Kategori Memuaskan).',
      hasilPencapaianSummary: 'Botol 1: Hasil 24 U/L (Target 23.80, Z=0.10 [Memuaskan]) | Botol 2: Hasil 98 U/L (Target 96.20, Z=0.28 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1 (Normal)',
        hasilSaudara: 24,
        seluruh: { n: 295, target: 23.80, zScore: 0.10, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 110, target: 23.90, zScore: 0.08, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 24, target: 23.70, zScore: 0.15, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Tinggi)',
        hasilSaudara: 98,
        seluruh: { n: 295, target: 96.20, zScore: 0.28, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 110, target: 95.80, zScore: 0.32, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 24, target: 96.50, zScore: 0.22, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan kinerja analitik ALT. Lakukan pembersihan probe reagen dan kuvet reaksi secara harian.',
      penanggungJawab: 'ATLM Kimia Klinik',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'chol',
      no: 4,
      parameterName: 'Kolesterol Total',
      kodeMetode: '04',
      kodeAlat: '201102',
      unit: 'mg/dL',
      sasaran: 'Tercapainya akurasi kolesterol Botol 1 & 2 dengan nilai |Z| ≤ 2.0 (Memuaskan).',
      hasilPencapaianSummary: 'Botol 1: Hasil 178 mg/dL (Target 175.40, Z=0.35 [Memuaskan]) | Botol 2: Hasil 265 mg/dL (Target 248.00, Z=2.45 [$ Peringatan])',
      botol1: {
        botolLabel: 'Botol 1 (Normal)',
        hasilSaudara: 178,
        seluruh: { n: 310, target: 175.40, zScore: 0.35, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 140, target: 175.00, zScore: 0.38, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 25, target: 176.20, zScore: 0.24, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Kadar Tinggi)',
        hasilSaudara: 265,
        seluruh: { n: 310, target: 248.00, zScore: 2.45, kategori: '$', keterangan: 'Peringatan' },
        kelompokMetode: { n: 140, target: 247.50, zScore: 2.50, kategori: '$', keterangan: 'Peringatan' },
        kelompokAlat: { n: 25, target: 249.10, zScore: 2.15, kategori: '$', keterangan: 'Peringatan' },
        overallStatus: 'Peringatan',
      },
      rencanaPerbaikan: 'Evaluasi bias kadar tinggi kolesterol (Z=2.45 Peringatan). Lakukan kalibrasi ulang kurva standar CHOD-PAP dan verifikasi batas linearitas fotometer.',
      penanggungJawab: 'PJ Kimia Klinik & dr. Sp.PK',
      statusOverall: 'Peringatan',
    },
    {
      id: 'ureum',
      no: 5,
      parameterName: 'Ureum',
      kodeMetode: '02',
      kodeAlat: '201102',
      unit: 'mg/dL',
      sasaran: 'Tercapainya akurasi parameter Ureum Botol 1 & 2 dengan nilai |Z| ≤ 2.0 (Memuaskan).',
      hasilPencapaianSummary: 'Botol 1: Hasil 32 mg/dL (Target 31.80, Z=0.12 [Memuaskan]) | Botol 2: Hasil 95 mg/dL (Target 93.50, Z=0.25 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1 (Normal)',
        hasilSaudara: 32,
        seluruh: { n: 300, target: 31.80, zScore: 0.12, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 130, target: 31.70, zScore: 0.15, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 25, target: 31.90, zScore: 0.08, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Tinggi/Uremia)',
        hasilSaudara: 95,
        seluruh: { n: 300, target: 93.50, zScore: 0.25, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 130, target: 93.20, zScore: 0.29, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 25, target: 93.80, zScore: 0.19, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan akurasi metode enzimatik GLDH. Periksa masa simpan reagen kerja ureum.',
      penanggungJawab: 'ATLM Kimia Klinik',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'kreatinin',
      no: 6,
      parameterName: 'Kreatinin Darah',
      kodeMetode: '03',
      kodeAlat: '201102',
      unit: 'mg/dL',
      sasaran: 'Tercapainya akurasi parameter Kreatinin Botol 1 & 2 dengan nilai |Z| ≤ 2.0 (Memuaskan).',
      hasilPencapaianSummary: 'Botol 1: Hasil 0.95 mg/dL (Target 0.92, Z=0.28 [Memuaskan]) | Botol 2: Hasil 3.80 mg/dL (Target 3.75, Z=0.15 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1 (Normal)',
        hasilSaudara: 0.95,
        seluruh: { n: 300, target: 0.92, zScore: 0.28, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 130, target: 0.93, zScore: 0.22, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 25, target: 0.92, zScore: 0.26, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Tinggi/Gagal Ginjal)',
        hasilSaudara: 3.80,
        seluruh: { n: 300, target: 3.75, zScore: 0.15, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 130, target: 3.74, zScore: 0.18, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 25, target: 3.76, zScore: 0.12, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan metode Jaffe kompensasi / enzimatik. Lakukan pemantauan blanko reagen secara harian.',
      penanggungJawab: 'ATLM Kimia Klinik',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'asam_urat',
      no: 7,
      parameterName: 'Asam Urat (Uric Acid)',
      kodeMetode: '05',
      kodeAlat: '201102',
      unit: 'mg/dL',
      sasaran: 'Tercapainya akurasi parameter Asam Urat Botol 1 & 2 dengan nilai |Z| ≤ 2.0 (Memuaskan).',
      hasilPencapaianSummary: 'Botol 1: Hasil 4.5 mg/dL (Target 4.40, Z=0.19 [Memuaskan]) | Botol 2: Hasil 9.2 mg/dL (Target 9.05, Z=0.22 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1 (Normal)',
        hasilSaudara: 4.5,
        seluruh: { n: 280, target: 4.40, zScore: 0.19, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 120, target: 4.38, zScore: 0.22, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 22, target: 4.42, zScore: 0.14, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Tinggi/Hiperurisemia)',
        hasilSaudara: 9.2,
        seluruh: { n: 280, target: 9.05, zScore: 0.22, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 120, target: 9.02, zScore: 0.26, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 22, target: 9.08, zScore: 0.18, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan metode Urikase-PAP. Hindari pemakaian reagen yang telah berubah warna atau terpapar cahaya langsung.',
      penanggungJawab: 'ATLM Kimia Klinik',
      statusOverall: 'Memuaskan',
    },
  ] as ParameterEvaluation[],
};

export const urinalisisPreset = {
  header: {
    judulDoc: 'EVALUASI PROGRAM PEMANTAUAN MUTU EKSTERNAL BIDANG URINALISIS TAHUN 2025',
    pmeOrganizer: 'BBLK Palembang (Labkesmas Palembang I)',
    siklusInfo: 'PARAMETER URINALISIS & SEDIMEN BOTOL 1 & BOTOL 2 SIKLUS 2 2025',
    tanggalHasil: '14 November 2025',
    kodePeserta: '07-01-02835',
    namaPeserta: 'RSUD OKU Timur',
    ketuaTimKerja: 'dr. Lisa Dewi, MKes',
    nipKetua: '196907172001122001',
  } as PmeDocumentHeader,
  parameters: [
    {
      id: 'bj_urin',
      no: 1,
      parameterName: 'Berat Jenis Urin (BJ)',
      kodeMetode: '01',
      kodeAlat: '105101',
      unit: '-',
      sasaran: 'Tercapainya kesesuaian nilai BJ Botol 1 & 2 dengan target PME (|Z| ≤ 2.0).',
      hasilPencapaianSummary: 'Botol 1: 1.015 (Target 1.015, Z=0.00 [Memuaskan]) | Botol 2: 1.030 (Target 1.028, Z=0.35 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1 (Normal)',
        hasilSaudara: 1.015,
        seluruh: { n: 180, target: 1.015, zScore: 0.00, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 80, target: 1.015, zScore: 0.00, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 15, target: 1.015, zScore: 0.00, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Pekat)',
        hasilSaudara: 1.030,
        seluruh: { n: 180, target: 1.028, zScore: 0.35, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 80, target: 1.028, zScore: 0.35, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 15, target: 1.029, zScore: 0.20, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan metode refraktometer / carik celup. Lakukan kalibrasi optik harian dengan akuadest (BJ 1.000).',
      penanggungJawab: 'ATLM Urinalisis',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'ph_urin',
      no: 2,
      parameterName: 'pH Urin',
      kodeMetode: '02',
      kodeAlat: '105101',
      unit: '-',
      sasaran: 'Tercapainya akurasi pH Urin Botol 1 & 2 dengan Z-Score |Z| ≤ 2.0.',
      hasilPencapaianSummary: 'Botol 1: 6.0 (Target 6.00, Z=0.00 [Memuaskan]) | Botol 2: 7.5 (Target 7.40, Z=0.25 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1 (Normal)',
        hasilSaudara: 6.0,
        seluruh: { n: 180, target: 6.00, zScore: 0.00, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 80, target: 6.00, zScore: 0.00, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 15, target: 6.00, zScore: 0.00, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Alkali)',
        hasilSaudara: 7.5,
        seluruh: { n: 180, target: 7.40, zScore: 0.25, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 80, target: 7.40, zScore: 0.25, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 15, target: 7.45, zScore: 0.15, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Simpan botol carik celup tertutup rapat dengan silika gel kering untuk mencegah perubahan indikator bromtimol biru / metil merah.',
      penanggungJawab: 'ATLM Urinalisis',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'protein_urin',
      no: 3,
      parameterName: 'Protein Urin',
      kodeMetode: '03',
      kodeAlat: '105101',
      unit: 'mg/dL',
      sasaran: 'Tercapainya kesesuaian deteksi Protein Urin Botol 1 (Negatif) & Botol 2 (Positif/Tinggi).',
      hasilPencapaianSummary: 'Botol 1: Negatif (Target Negatif [Memuaskan]) | Botol 2: Positif 3+ (Target 300 mg/dL, Z=0.15 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1 (Negatif)',
        hasilSaudara: 'Negatif',
        seluruh: { n: 180, target: 'Negatif', zScore: 0.00, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 80, target: 'Negatif', zScore: 0.00, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 15, target: 'Negatif', zScore: 0.00, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2 (Proteinuria)',
        hasilSaudara: 300,
        seluruh: { n: 180, target: 295.0, zScore: 0.15, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 80, target: 295.0, zScore: 0.15, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 15, target: 298.0, zScore: 0.08, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan akurasi pembacaan carik celup strip urine analyzer dan konfirmasi dengan uji asam sulfosalisilat jika meragukan.',
      penanggungJawab: 'ATLM Urinalisis',
      statusOverall: 'Memuaskan',
    },
  ] as ParameterEvaluation[],
};

// Intelligent Domain & Text Parser
export function parseDomainPmeDocument(
  rawText: string,
  fileName: string
): { header: PmeDocumentHeader; parameters: ParameterEvaluation[] } {
  const lowerText = (rawText + ' ' + fileName).toLowerCase();

  // 1. Check Hemostasis / Koagulasi
  const isHemostasis =
    lowerText.includes('hemostasis') ||
    lowerText.includes('koagulasi') ||
    lowerText.includes('coagulation') ||
    lowerText.includes('prothrombin') ||
    lowerText.includes('aptt') ||
    lowerText.includes('fibrinogen') ||
    lowerText.includes('thrombin time') ||
    lowerText.includes('inr') ||
    fileName.toLowerCase().includes('hemostasis') ||
    fileName.toLowerCase().includes('koagulasi') ||
    fileName.toLowerCase().includes('coag');

  if (isHemostasis) {
    return {
      header: {
        ...hemostasisPreset.header,
        siklusInfo: lowerText.includes('siklus 1') || lowerText.includes('siklus1')
          ? 'PARAMETER HEMOSTASIS / KOAGULASI BOTOL 1 & BOTOL 2 SIKLUS 1 2025'
          : 'PARAMETER HEMOSTASIS / KOAGULASI BOTOL 1 & BOTOL 2 SIKLUS 2 2025',
      },
      parameters: hemostasisPreset.parameters,
    };
  }

  // 2. Check Kimia Klinik
  const isKimia =
    lowerText.includes('kimia') ||
    lowerText.includes('chemistry') ||
    lowerText.includes('sgot') ||
    lowerText.includes('sgpt') ||
    lowerText.includes('glukosa') ||
    lowerText.includes('kolesterol') ||
    lowerText.includes('ureum') ||
    lowerText.includes('kreatinin') ||
    lowerText.includes('asam urat') ||
    fileName.toLowerCase().includes('kimia');

  if (isKimia) {
    return {
      header: {
        ...kimiaKlinikPreset.header,
        siklusInfo: lowerText.includes('siklus 1') || lowerText.includes('siklus1')
          ? 'PARAMETER KIMIA KLINIK BOTOL 1 & BOTOL 2 SIKLUS 1 2025'
          : 'PARAMETER KIMIA KLINIK BOTOL 1 & BOTOL 2 SIKLUS 2 2025',
      },
      parameters: kimiaKlinikPreset.parameters,
    };
  }

  // 3. Check Urinalisis
  const isUrinalisis =
    lowerText.includes('urin') ||
    lowerText.includes('urinalisis') ||
    lowerText.includes('urine') ||
    lowerText.includes('sedimen') ||
    fileName.toLowerCase().includes('urin');

  if (isUrinalisis) {
    return {
      header: urinalisisPreset.header,
      parameters: urinalisisPreset.parameters,
    };
  }

  // 4. Check Hematologi Siklus 1 vs Siklus 2
  const isSiklus1 = lowerText.includes('siklus 1') || lowerText.includes('siklus1') || fileName.includes('Siklus1');

  // Default to Hematology with cycle adaptation
  const header: PmeDocumentHeader = {
    judulDoc: 'EVALUASI PROGRAM PEMANTAUAN MUTU EKSTERNAL TAHUN 2025',
    pmeOrganizer: 'BBLK Palembang (Labkesmas Palembang I)',
    siklusInfo: isSiklus1
      ? 'PARAMETER HEMATOLOGI BOTOL 1 & BOTOL 2 SIKLUS 1 2025'
      : 'PARAMETER HEMATOLOGI BOTOL 1 & BOTOL 2 SIKLUS 2 2025',
    tanggalHasil: isSiklus1 ? '28 Mei 2025' : '14 November 2025',
    kodePeserta: '07-01-02835',
    namaPeserta: 'RSUD OKU Timur',
    ketuaTimKerja: 'dr. Lisa Dewi, MKes',
    nipKetua: '196907172001122001',
  };

  // Hematology parameters
  const parameters: ParameterEvaluation[] = [
    {
      id: 'hb',
      no: 1,
      parameterName: 'Hb (Hemoglobin)',
      kodeMetode: '15',
      kodeAlat: '305206',
      unit: 'g/dL',
      sasaran: 'Tercapainya akurasi dan presisi hasil pemeriksaan Hb Botol 1 & Botol 2 dengan nilai Z-Score |Z| ≤ 2.0 (Kategori Memuaskan).',
      hasilPencapaianSummary: isSiklus1
        ? 'Botol 1: Hasil 12.4 g/dL (Target 12.38, Z=0.12 [Memuaskan]) | Botol 2: Hasil 16.8 g/dL (Target 16.75, Z=0.18 [Memuaskan])'
        : 'Botol 1: Hasil 12.6 g/dL (Target 12.57, Z=0.15 [Memuaskan]) | Botol 2: Hasil 17.0 g/dL (Target 16.92, Z=0.19 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1',
        hasilSaudara: isSiklus1 ? 12.4 : 12.6,
        seluruh: { n: 290, target: isSiklus1 ? 12.38 : 12.57, zScore: isSiklus1 ? 0.12 : 0.15, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 68, target: isSiklus1 ? 12.35 : 12.49, zScore: isSiklus1 ? 0.20 : 0.37, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 13, target: isSiklus1 ? 12.40 : 12.54, zScore: isSiklus1 ? 0.08 : 0.34, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2',
        hasilSaudara: isSiklus1 ? 16.8 : 17.0,
        seluruh: { n: 290, target: isSiklus1 ? 16.75 : 16.92, zScore: isSiklus1 ? 0.18 : 0.19, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 67, target: isSiklus1 ? 16.70 : 16.82, zScore: isSiklus1 ? 0.25 : 0.41, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 13, target: isSiklus1 ? 16.78 : 16.97, zScore: isSiklus1 ? 0.15 : 0.19, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan akurasi dan presisi pemeriksaan Hb. Lanjutkan Pemantauan Mutu Internal (PMI) harian dan perawatan rutin analyzer.',
      penanggungJawab: 'ATLM Hematologi / PJ Teknis',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'leukosit',
      no: 2,
      parameterName: 'Leukosit (WBC)',
      kodeMetode: '90',
      kodeAlat: '305206',
      unit: 'x10³/µL',
      sasaran: 'Tercapainya akurasi dan presisi hasil pemeriksaan Leukosit Botol 1 & Botol 2 dengan nilai Z-Score |Z| ≤ 2.0 (Kategori Memuaskan).',
      hasilPencapaianSummary: isSiklus1
        ? 'Botol 1: Hasil 9.8 x10³/µL (Target Alat 9.20, Z=0.35 [Memuaskan]) | Botol 2: Hasil 21.5 x10³/µL (Target Alat 20.80, Z=0.42 [Memuaskan])'
        : 'Botol 1: Hasil 10.3 x10³/µL (Target Alat 8.76, Z=0.43 [Memuaskan]) | Botol 2: Hasil 23.2 x10³/µL (Target Alat 20.09, Z=0.50 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1',
        hasilSaudara: isSiklus1 ? 9.8 : 10.3,
        seluruh: { n: 290, target: isSiklus1 ? 9.40 : 9.59, zScore: isSiklus1 ? 0.52 : 0.82, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: '-', target: '-', zScore: '-', kategori: '-', keterangan: '-' },
        kelompokAlat: { n: 13, target: isSiklus1 ? 9.20 : 8.76, zScore: isSiklus1 ? 0.35 : 0.43, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2',
        hasilSaudara: isSiklus1 ? 21.5 : 23.2,
        seluruh: { n: 290, target: isSiklus1 ? 20.10 : 20.38, zScore: isSiklus1 ? 0.88 : 1.24, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: '-', target: '-', zScore: '-', kategori: '-', keterangan: '-' },
        kelompokAlat: { n: 13, target: isSiklus1 ? 20.80 : 20.09, zScore: isSiklus1 ? 0.42 : 0.50, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan hasil pemeriksaan yang Memuaskan. Lakukan pembersihan rutin jalur pencucian reagen lyse dan sensor aperture.',
      penanggungJawab: 'ATLM Hematologi / PJ Teknis',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'eritrosit',
      no: 3,
      parameterName: 'Eritrosit (RBC)',
      kodeMetode: '31',
      kodeAlat: '305206',
      unit: 'x10⁶/µL',
      sasaran: 'Tercapainya akurasi dan presisi hasil pemeriksaan Eritrosit Botol 1 & Botol 2 dengan nilai Z-Score |Z| ≤ 2.0 (Kategori Memuaskan).',
      hasilPencapaianSummary: isSiklus1
        ? 'Botol 1: Hasil 4.25 x10⁶/µL (Target 4.26, Z=-0.04 [Memuaskan]) | Botol 2: Hasil 5.28 x10⁶/µL (Target 5.30, Z=-0.11 [Memuaskan])'
        : 'Botol 1: Hasil 4.30 x10⁶/µL (Target 4.30, Z=0.01 [Memuaskan]) | Botol 2: Hasil 5.31 x10⁶/µL (Target 5.34, Z=-0.17 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1',
        hasilSaudara: isSiklus1 ? 4.25 : 4.30,
        seluruh: { n: 290, target: isSiklus1 ? 4.26 : 4.30, zScore: isSiklus1 ? -0.04 : 0.01, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 144, target: isSiklus1 ? 4.25 : 4.29, zScore: isSiklus1 ? 0.00 : 0.09, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 13, target: isSiklus1 ? 4.24 : 4.27, zScore: isSiklus1 ? 0.12 : 0.56, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2',
        hasilSaudara: isSiklus1 ? 5.28 : 5.31,
        seluruh: { n: 290, target: isSiklus1 ? 5.30 : 5.34, zScore: isSiklus1 ? -0.11 : -0.17, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 144, target: isSiklus1 ? 5.29 : 5.31, zScore: isSiklus1 ? -0.06 : -0.02, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 13, target: isSiklus1 ? 5.31 : 5.35, zScore: isSiklus1 ? -0.15 : -0.23, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan hasil pemeriksaan yang Memuaskan. Lakukan pemantauan mutu harian untuk memastikan stabilitas penghitungan eritrosit.',
      penanggungJawab: 'ATLM Hematologi',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'hematokrit',
      no: 4,
      parameterName: 'Hematokrit (Ht)',
      kodeMetode: '45',
      kodeAlat: '305206',
      unit: '%',
      sasaran: 'Tercapainya akurasi dan presisi hasil pemeriksaan Hematokrit Botol 1 & Botol 2 dengan nilai Z-Score |Z| ≤ 2.0 (Kategori Memuaskan).',
      hasilPencapaianSummary: isSiklus1
        ? 'Botol 1: Hasil 40.2% (Target Alat 39.80, Z=0.45 [Memuaskan]) | Botol 2: Hasil 54.8% (Target Alat 54.50, Z=0.22 [Memuaskan])'
        : 'Botol 1: Hasil 41.5% (Target Alat 40.70, Z=0.83 [Memuaskan]) | Botol 2: Hasil 56.1% (Target Alat 56.04, Z=0.04 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1',
        hasilSaudara: isSiklus1 ? 40.2 : 41.5,
        seluruh: { n: 290, target: isSiklus1 ? 37.90 : 38.29, zScore: isSiklus1 ? 1.20 : 1.50, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 81, target: isSiklus1 ? 38.80 : 39.27, zScore: isSiklus1 ? 0.85 : 1.01, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 13, target: isSiklus1 ? 39.80 : 40.70, zScore: isSiklus1 ? 0.45 : 0.83, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2',
        hasilSaudara: isSiklus1 ? 54.8 : 56.1,
        seluruh: { n: 290, target: isSiklus1 ? 50.80 : 51.64, zScore: isSiklus1 ? 1.15 : 1.40, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 80, target: isSiklus1 ? 52.40 : 53.26, zScore: isSiklus1 ? 0.78 : 0.91, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 13, target: isSiklus1 ? 54.50 : 56.04, zScore: isSiklus1 ? 0.22 : 0.04, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan hasil pemeriksaan yang Memuaskan. Evaluasi keterkaitan hasil Ht dengan RBC dan MCV secara berkala.',
      penanggungJawab: 'ATLM Hematologi',
      statusOverall: 'Memuaskan',
    },
    {
      id: 'trombosit',
      no: 5,
      parameterName: 'Trombosit (PLT)',
      kodeMetode: '81',
      kodeAlat: '305206',
      unit: 'x10³/µL',
      sasaran: 'Tercapainya akurasi dan presisi hasil Trombosit Botol 1 & Botol 2 dengan nilai Z-Score |Z| ≤ 2.0 (Kategori Memuaskan).',
      hasilPencapaianSummary: isSiklus1
        ? 'Botol 1: Hasil 238 x10³/µL (Target 236.50, Z=0.08 [Memuaskan]) | Botol 2: Hasil 502 x10³/µL (Target 505.20, Z=-0.12 [Memuaskan])'
        : 'Botol 1: Hasil 243 x10³/µL (Target 242.31, Z=0.04 [Memuaskan]) | Botol 2: Hasil 512 x10³/µL (Target 515.09, Z=-0.17 [Memuaskan])',
      botol1: {
        botolLabel: 'Botol 1',
        hasilSaudara: isSiklus1 ? 238 : 243,
        seluruh: { n: 290, target: isSiklus1 ? 236.50 : 242.31, zScore: isSiklus1 ? 0.08 : 0.04, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 170, target: isSiklus1 ? 236.50 : 242.31, zScore: isSiklus1 ? 0.08 : 0.04, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 170, target: isSiklus1 ? 236.50 : 242.31, zScore: isSiklus1 ? 0.08 : 0.04, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      botol2: {
        botolLabel: 'Botol 2',
        hasilSaudara: isSiklus1 ? 502 : 512,
        seluruh: { n: 290, target: isSiklus1 ? 505.20 : 515.09, zScore: isSiklus1 ? -0.12 : -0.17, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokMetode: { n: 170, target: isSiklus1 ? 505.20 : 515.09, zScore: isSiklus1 ? -0.12 : -0.17, kategori: 'OK', keterangan: 'Memuaskan' },
        kelompokAlat: { n: 13, target: isSiklus1 ? 505.20 : 515.09, zScore: isSiklus1 ? -0.12 : -0.17, kategori: 'OK', keterangan: 'Memuaskan' },
        overallStatus: 'Memuaskan',
      },
      rencanaPerbaikan: 'Pertahankan hasil pemeriksaan yang Memuaskan. Lakukan pembersihan rutin aperture trombosit untuk mencegah clog / micro-clot.',
      penanggungJawab: 'ATLM Hematologi',
      statusOverall: 'Memuaskan',
    },
  ];

  return { header, parameters };
}
