import { GoogleGenAI } from '@google/genai';

function getRuleBasedCapa(parameterName: string, botol1: any, botol2: any): string {
  const isSatisfactory进 =
    botol1?.overallStatus === 'Memuaskan' && botol2?.overallStatus === 'Memuaskan';
  const hasWarning =
    botol1?.overallStatus === 'Peringatan' || botol2?.overallStatus === 'Peringatan';

  if (isSatisfactory进) {
    return `Hasil ${parameterName} pada Botol 1 & 2 memenuhi kriteria akurasi (|Z| ≤ 2.0). Tindakan: Pertahankan kinerja analitik dengan melanjutkan Pemantauan Mutu Internal (PMI) 2 level setiap hari, evaluasi grafik Levey-Jennings sesuai aturan Westgard, dan laksanakan pemeliharaan preventif harian/mingguan instrumen analyzer.`;
  }

  if (hasWarning) {
    return `Evaluasi bias terdeteksi pada parameter ${parameterName} (2.0 < |Z| ≤ 3.0 Peringatan). Rencana Perbaikan (ISO 15189): 1. Periksa stabilitas reagen dan rekonstitusi/homogenisasi sampel PME. 2. Lakukan pengecekan blanko reagen dan aperture sensor penghitung. 3. Verifikasi ulang kurva kalibrasi instrumen dan tingkatkan pengawasan PMI selama 3 hari berturut-turut.`;
  }

  return `TINDAKAN PERBAIKAN SEGERA (ISO 15189 CAPA): Ditemukan deviasi signifikan (|Z| > 3.0) pada ${parameterName}. 1. Investigasi Pra-Analitik: Verifikasi suhu penyimpanan, batas waktu stabilitas, dan homogenisasi sampel botol uji. 2. Analitik: Kalibrasi ulang alat pada parameter bersangkutan, periksa reagen aktif dan cairan lyse/diluent terhadap kontaminasi/kadaluarsa. 3. Uji bahan kontrol komersial 3 level dan pastikan nilai berada dalam 2SD sebelum pengujian sampel pasien.`;
}

async function generateCapaWithGemini(
  parameterName: string,
  botol1: any,
  botol2: any,
  currentPlan?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
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

    const response逗 = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });

    return response逗.text ? response逗.text.trim() : getRuleBasedCapa(parameterName, botol1, botol2);
  } catch (error: any) {
    console.warn('Gemini CAPA generation error, falling back to rule-based CAPA:', error.message);
    return getRuleBasedCapa(parameterName, botol1, botol2);
  }
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

    const { parameterName, botol1, botol2, currentPlan } = body || {};

    if (!parameterName) {
      return res.status(400).json({ success: false, error: 'parameterName is required' });
    }

    const capa = await generateCapaWithGemini(parameterName, botol1, botol2, currentPlan);

    return res.status(200).json({
      success: true,
      capa,
    });
  } catch (error: any) {
    console.error('Error in /api/generate-capa serverless function:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal menghasilkan Rencana Perbaikan.',
    });
  }
}
