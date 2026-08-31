import { generateCapaWithGemini } from './_gemini';

export default async function handler(req: any, res: any) {
  // Support CORS for flexibility
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
    const { parameterName, botol1, botol2, currentPlan } = req.body || {};

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
