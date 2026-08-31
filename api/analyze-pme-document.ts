import { analyzePmeDocumentWithGemini } from './_gemini';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

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
    const { fileName, fileBase64, mimeType, textContent } = req.body || {};

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
