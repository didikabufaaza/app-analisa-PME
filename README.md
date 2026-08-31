# Aplikasi Evaluasi & Analisa PME Laboratorium (ISO 15189)

Aplikasi Evaluasi & Pelaporan Pemantauan Mutu Eksternal (PME / External Quality Assessment) Laboratorium Medik berstandar ISO 15189, dilengkapi analisis otomatis berbasis AI Gemini dan generator Corrective Action & Preventive Action (CAPA).

## Fitur Utama

- **Ekstraksi Dokumen PME Otomatis**: Mendukung upload dokumen PDF, Excel (.xlsx, .xls), CSV, dan teks dari berbagai penyelenggara (BBLK, Labkesmas, PDS PatKLIn, ILKI, Bio-Rad EQAS, dll).
- **Analisa Cerdas Berbasis AI Gemini & Standar Mutu ISO 15189**: Evaluasi akurasi nilai $Z$-Score (Memuaskan, Peringatan, Kurang Memuaskan) dan Root Cause Analysis (RCA).
- **Generator CAPA (Rencana Perbaikan)**: Rekomendasi tindakan perbaikan otomatis untuk tahap Pra-Analitik, Analitik (Reagen, Kalibrasi, PMI harian, Westgard Rules), dan Pasca-Analitik.
- **Tabel Evaluasi Resmi 5 Kolom**: Format standar resmi pelaporan evaluasi mutu laboratorium.
- **Pengaturan & Simpan Tanda Tangan**: Mendukung penandatangan dinamis (1, 2, atau 3 kolom) dengan upload tanda tangan digital.
- **Ekspor Dokumen**:
  - **Export Excel (.xls)** berstruktur rapi dengan UTF-8 BOM.
  - **Cetak PDF (Print A4)** dengan layout khusus cetak.
  - **Unduh PDF Langsung (Direct PDF)** beresolusi tinggi.

## Teknologi

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, html2pdf.js, pdfjs-dist
- **Backend & Serverless**: Express.js, Vercel Serverless Functions (`/api/*`)
- **AI Engine**: Google Gen AI SDK (`@google/genai`, Gemini 3.7 Flash)

## Panduan Menjalankan Lokal

```bash
# Install dependencies
npm install

# Jalankan server development (port 3000)
npm run dev

# Build production
npm run build
```

## Deployment di Vercel

Aplikasi ini sudah dikonfigurasi dengan `vercel.json` dan folder `/api/` untuk berjalan otomatis di platform Vercel. Pastikan menambahkan Environment Variable di Vercel:
- `GEMINI_API_KEY`: API Key Google Gemini Anda
