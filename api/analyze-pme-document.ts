import { GoogleGenAI } from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

async function analyzePmeDocumentWithGemini(payload: {
  fileName?: string;
  fileBase64?: string;
  mimeType?: string;
  textContent?: string;
}): Promise<any> {
  const { fileName, fileBase64, mimeType, textContent } = payload;
  const apiKey = process.env.GEMINI_API_KEY;

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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {}
    }

    const { fileName, fileBase64, mimeType, textContent } = body || {};

    const parsedData = await analyzePmeDocumentWithGemini({
      fileName,
      fileBase64,
      mimeType,
      textContent,
    });

    if (!parsedData) {
      return res.status(200).json({
        success: true,
        source: 'local_parser',
        message: 'Hasil analisa otomatis siap (mode analisa aturan standar ISO 15189).',
      });
    }

    return res.status(200).json({
      success: true,
      source: 'gemini-3.7-flash',
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error in /api/analyze-pme-document serverless function:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal menganalisa dokumen PME.',
    });
  }
}
