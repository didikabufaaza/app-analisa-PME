import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { generateCapaWithGemini, analyzePmeDocumentWithGemini } from './api/_gemini';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Route for AI RCA & CAPA generation
  app.post('/api/generate-capa', async (req, res) => {
    try {
      const { parameterName, botol1, botol2, currentPlan } = req.body;

      if (!parameterName) {
        return res.status(400).json({ success: false, error: 'parameterName is required' });
      }

      const capa = await generateCapaWithGemini(parameterName, botol1, botol2, currentPlan);

      return res.json({
        success: true,
        capa,
      });
    } catch (error: any) {
      console.error('Error in /api/generate-capa:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Gagal menghasilkan Rencana Perbaikan.',
      });
    }
  });

  // API Route for Automated PME Document Analysis (PDF, Excel, CSV, Text)
  app.post('/api/analyze-pme-document', async (req, res) => {
    try {
      const { fileName, fileBase64, mimeType, textContent } = req.body;

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

      return res.json({
        success: true,
        source: 'gemini-3.7-flash',
        data: parsedData,
      });
    } catch (error: any) {
      console.error('Error in /api/analyze-pme-document:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Gagal menganalisa dokumen PME.',
      });
    }
  });

  // Vite middleware for dev mode
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
