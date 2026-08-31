import { GoogleGenAI } from '@google/genai';

// Gemini API Key from environment variable (GEMINI_API_KEY in Vercel / server)
export const DEFAULT_GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export function getRuleBasedCapa(parameterName: string, botol1: any, botol2: any): string {
  const isSatisfactory =
    botol1?.overallStatus === 'Memuaskan' && botol2?.overallStatus === 'Memuaskan';
  const hasWarning =
    botol1?.overallStatus === 'Peringatan' || botol2?.overallStatus === 'Peringatan';
  const hasUnsatisfactory =
    botol1?.overallStatus === 'Kurang Memuaskan' || botol2?.overallStatus === 'Kurang Memuaskan';

  if (isSatisfactory) {
    return `Hasil ${parameterName} pada Botol 1 & 2 memenuhi kriteria akurasi (|Z| ≤ 2.0). Tindakan: Pertahankan kinerja analitik dengan melanjutkan Pemantauan Mutu Internal (PMI) 2 level setiap hari, evaluasi grafik Levey-Jennings sesuai aturan Westgard, dan laksanakan pemeliharaan preventif harian/mingguan instrumen analyzer.`;
  }

  if (hasWarning && !hasUnsatisfactory) {
    return `Evaluasi bias terdeteksi pada parameter ${parameterName} (2.0 < |Z| ≤ 3.0 Peringatan). Rencana Perbaikan (ISO 15189): 1. Periksa stabilitas reagen dan rekonstitusi/homogenisasi sampel PME. 2. Lakukan pengecekan blanko reagen dan aperture sensor penghitung. 3. Verifikasi ulang kurva kalibrasi instrumen dan tingkatkan pengawasan PMI selama 3 hari berturut-turut.`;
  }

  return `TINDAKAN PERBAIKAN SEGERA (ISO 15189 CAPA): Ditemukan deviasi signifikan (|Z| > 3.0) pada ${parameterName}. 1. Investigasi Pra-Analitik: Verifikasi suhu penyimpanan, batas waktu stabilitas, dan homogenisasi sampel botol uji. 2. Analitik: Kalibrasi ulang alat pada parameter bersangkutan, periksa reagen aktif dan cairan lyse/diluent terhadap kontaminasi/kadaluarsa. 3. Uji bahan kontrol komersial 3 level dan pastikan nilai berada dalam 2SD sebelum pengujian sampel pasien.`;
}

export async function generateCapaWithGemini(
  parameterName: string,
  botol1: any,
  botol2: any,
  currentPlan?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || DEFAULT_GEMINI_API_KEY;
  if (!apiKey) {
    return getRuleBasedCapa(parameterName, botol1, botol2);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Anda adalah Dokter Spesialis Patologi Klinik (Sp.PK) & Manajer Mutu Laboratorium Kesehatan ISO 15189.
Buatkan Rencana Perbaikan (Corrective Action Plan / CAPA) & Root Cause Analysis (RCA) yang singkat, padat, aplikatif dan profesional dalam Bahasa Indonesia untuk parameter Pemantauan Mutu Eksternal (PME) laboratorium berikut:

Parameter: ${parameterName}
Hasil Botol 1: ${JSON.stringify(botol1)}
Hasil Botol 2: ${JSON.stringify(botol2)}
Rencana Saat Ini: ${currentPlan || '-'}

Petunjuk:
1. Sesuaikan tindakan perbaikan secara akurat berdasarkan bidang parameter (misal Hemostasis/Koagulasi seperti PT/APTT/Fibrinogen, Kimia Klinik, Urinalisis, Imunologi, atau Hematologi).
2. Buat rekomendasi dalam 2-4 kalimat yang siap dimasukkan ke formulir evaluasi PME laboratorium.
3. Fokus pada aspek Analitik (reagen, kalibrator, suhu 37C, inkubasi, PMI harian, Westgard rules), Pre-Analitik (stabilitas sampel, rekonstitusi, homogenisasi), dan Post-Analitik.
4. Gunakan bahasa baku laboratorium klinik dan jangan menggunakan format markdown tebal yang berlebihan.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });

    return response.text ? response.text.trim() : getRuleBasedCapa(parameterName, botol1, botol2);
  } catch (error: any) {
    console.warn('Gemini CAPA generation error, falling back to rule-based CAPA:', error.message);
    return getRuleBasedCapa(parameterName, botol1, botol2);
  }
}

export async function analyzePmeDocumentWithGemini(payload: {
  fileName?: string;
  fileBase64?: string;
  mimeType?: string;
  textContent?: string;
}): Promise<any> {
  const { fileName, fileBase64, mimeType, textContent } = payload;
  const apiKey = process.env.GEMINI_API_KEY || DEFAULT_GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const systemPrompt = `Anda adalah sistem AI Spesialis Analisa dan Ekstraksi Dokumen Evaluasi Program Pemantauan Mutu Eksternal (PME / External Quality Assessment / Uji Profisiensi) Laboratorium Medik ISO 15189 (seperti BBLK, Labkesmas, PDS PatKLIn, ILKI, Bio-Rad EQAS, RCPA).

ATURAN UTAMA & WAJIB:
1. DATA HARUS 100% SESUAI DOKUMEN YANG DIUNGGAH:
   - Ekstrak secara PRESISI nama instansi/laboratorium, kode peserta, penyelenggara PME, judul evaluasi, dan tanggal dari dokumen.
   - Ekstrak SEMUA parameter yang ada pada tabel dokumen (baik 1 parameter, 5 parameter, 15 parameter, dst).
   - Nilai Hasil Peserta ("Hasil Saudara"), Nilai Target ("Target / Mean"), dan "Z-Score" untuk Botol 1 dan Botol 2 HARUS TEPAT SESUAI ANGKA DALAM DOKUMEN. JANGAN MENGARANG ATAU MENULISKAN ANGKA DARI CONTOH LAIN!
   - JANGAN PERNAH mengubah bidang laboratorium (contoh: jika dokumen Hemostasis, ekstrak PT/APTT/Fibrinogen; jika Kimia, ekstrak SGOT/SGPT/Glukosa; jika Urinalisis, ekstrak pH/BJ/Protein; jika Hematologi, ekstrak Hb/Leukosit/dll).

2. EVALUASI Z-SCORE & STATUS MUTU (Berdasarkan nilai Z-Score riil di dokumen):
   - Jika |Z| <= 2.0 -> Kategori "OK", Keterangan "Memuaskan"
   - Jika 2.0 < |Z| <= 3.0 -> Kategori "$", Keterangan "Peringatan"
   - Jika |Z| > 3.0 -> Kategori "$$", Keterangan "Kurang Memuaskan"

3. RENCANA PERBAIKAN (CAPA ISO 15189):
   - Hasilkan Rencana Perbaikan yang relevan secara teknis analitik laboratorium untuk masing-masing parameter berdasarkan hasil evaluasinya (Memuaskan/Peringatan/Kurang Memuaskan).

Format output WAJIB dalam struktur JSON berikut:
{
  "header": {
    "judulDoc": "Judul dari dokumen (e.g. EVALUASI PROGRAM PEMANTAUAN MUTU EKSTERNAL TAHUN 2025)",
    "pmeOrganizer": "Penyelenggara dari dokumen (e.g. BBLK Palembang / Labkesmas)",
    "siklusInfo": "Informasi Bidang & Siklus (e.g. PARAMETER HEMOSTASIS BOTOL 1 & BOTOL 2 SIKLUS 2 2025)",
    "tanggalHasil": "Tanggal yang tertera di dokumen",
    "kodePeserta": "Kode Peserta dari dokumen (atau '-' jika tidak ada)",
    "namaPeserta": "Nama Rumah Sakit / Laboratorium / Fasyankes dari dokumen",
    "ketuaTimKerja": "Nama Penanggung Jawab / Ketua Tim Kerja dari dokumen (atau '-' jika tidak ada)",
    "nipKetua": "NIP jika ada di dokumen (atau '-')"
  },
  "parameters": [
    {
      "id": "slug_parameter",
      "no": 1,
      "parameterName": "Nama Parameter persis di dokumen (e.g. PT (Masa Protrombin))",
      "kodeMetode": "Kode Metode di dokumen (atau '-')",
      "kodeAlat": "Kode Alat di dokumen (atau '-')",
      "unit": "Satuan di dokumen (e.g. detik, mg/dL, ratio, g/dL, U/L, %)",
      "sasaran": "Tercapainya akurasi hasil pemeriksaan [Nama Parameter] Botol 1 & 2 dengan Z-Score |Z| <= 2.0 (Kategori Memuaskan).",
      "hasilPencapaianSummary": "Ringkasan nilai riil: Botol 1: Hasil [X] [Unit] (Target [Y], Z=[Z] [[Status]]) | Botol 2: Hasil [A] [Unit] (Target [B], Z=[C] [[Status]])",
      "botol1": {
        "botolLabel": "Botol 1",
        "hasilSaudara": 12.5,
        "seluruh": { "n": 120, "target": 12.3, "zScore": 0.35, "kategori": "OK", "keterangan": "Memuaskan" },
        "kelompokMetode": { "n": 45, "target": 12.4, "zScore": 0.28, "kategori": "OK", "keterangan": "Memuaskan" },
        "kelompokAlat": { "n": 12, "target": 12.35, "zScore": 0.30, "kategori": "OK", "keterangan": "Memuaskan" },
        "overallStatus": "Memuaskan"
      },
      "botol2": {
        "botolLabel": "Botol 2",
        "hasilSaudara": 24.8,
        "seluruh": { "n": 120, "target": 24.2, "zScore": 0.42, "kategori": "OK", "keterangan": "Memuaskan" },
        "kelompokMetode": { "n": 45, "target": 24.1, "zScore": 0.45, "kategori": "OK", "keterangan": "Memuaskan" },
        "kelompokAlat": { "n": 12, "target": 24.3, "zScore": 0.38, "kategori": "OK", "keterangan": "Memuaskan" },
        "overallStatus": "Memuaskan"
      },
      "rencanaPerbaikan": "Tindakan / Rencana Perbaikan teknis spesifik ISO 15189 untuk parameter ini.",
      "penanggungJawab": "Penanggung Jawab / ATLM terkait",
      "statusOverall": "Memuaskan"
    }
  ]
}

Keluarkan HANYA JSON murni tanpa pembungkus teks di luar format JSON.`;

  let parts: any[] = [];

  if (fileBase64 && mimeType === 'application/pdf') {
    parts = [
      {
        inlineData: {
          data: fileBase64,
          mimeType: 'application/pdf',
        },
      },
      {
        text: `Berikut adalah file dokumen PDF Laporan Hasil PME: "${fileName || 'Laporan_PME.pdf'}".
${textContent ? `\n[Teks Hasil Ekstraksi PDF Layer]:\n${textContent}\n` : ''}
Instruksi:
Bacalah tabel dan data dalam dokumen ini secara seksama. Ekstrak SELURUH parameter laboratorium, nilai hasil peserta riil, target mean riil, Z-score riil, satuan, metode, alat, serta header peserta/penyelenggara persis sesuai isi dokumen. Kemudian susun Rencana Perbaikan (CAPA) yang relevan untuk setiap parameter dalam format JSON.`,
      },
    ];
  } else {
    parts = [
      {
        text: `Berikut adalah data dari file dokumen PME "${fileName || 'Data_PME'}":\n\n${textContent || fileBase64 || 'Data kosong'}\n\nInstruksi:
Ekstrak SELURUH parameter, nilai hasil peserta riil, nilai target riil, Z-score riil, satuan, metode, alat, nama peserta/fasyankes, dan penyelenggara PME yang ada di dalam teks ini secara akurat ke dalam format JSON yang ditentukan.`,
      },
    ];
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.7-flash',
    contents: { parts },
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
    },
  });

  const responseText = response.text?.trim() || '{}';
  return JSON.parse(responseText);
}
