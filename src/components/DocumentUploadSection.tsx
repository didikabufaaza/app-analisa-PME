import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  Trash2,
  PlusCircle,
  FolderOpen,
  X,
  Droplets,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PmeDocumentHeader, ParameterEvaluation, UploadedDocumentRecord } from '../types';
import {
  parseDomainPmeDocument,
  hemostasisPreset,
  kimiaKlinikPreset,
  urinalisisPreset,
} from '../data/pmeDomainParsers';
import { extractTextFromPdf } from '../utils/pdfExtractor';
import { extractDataFromRealPmeText } from '../utils/realPmeParser';
import { ConfirmModal } from './ConfirmModal';

interface DocumentUploadSectionProps {
  onAddDocument: (
    docRecord: UploadedDocumentRecord,
    header: PmeDocumentHeader,
    parameters: ParameterEvaluation[],
    appendMode: boolean
  ) => void;
  uploadedDocs: UploadedDocumentRecord[];
  onDeleteDocument: (docId: string) => void;
  onClearAllDocuments: () => void;
  totalParametersCount: number;
}

export const DocumentUploadSection: React.FC<DocumentUploadSectionProps> = ({
  onAddDocument,
  uploadedDocs,
  onDeleteDocument,
  onClearAllDocuments,
  totalParametersCount,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [textContent, setTextContent] = useState<string>('');
  const [appendMode, setAppendMode] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [docToDelete, setDocToDelete] = useState<UploadedDocumentRecord | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClearSelectedFile = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedFile(null);
    setFileBase64('');
    setTextContent('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setStatusMessage(null);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isTextOrCsv =
      file.type.includes('text') ||
      file.type.includes('csv') ||
      file.name.toLowerCase().endsWith('.csv') ||
      file.name.toLowerCase().endsWith('.txt');
    const isExcel =
      file.name.toLowerCase().endsWith('.xlsx') ||
      file.name.toLowerCase().endsWith('.xls') ||
      file.type.includes('spreadsheet') ||
      file.type.includes('excel');

    if (isPdf) {
      // 1. Read base64 for Gemini vision/PDF multimodal API
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        const base64Data = result.includes('base64,') ? result.split('base64,')[1] : result;
        setFileBase64(base64Data);

        // 2. Also extract real text layers using pdfjs-dist for accurate text matching
        try {
          const extractedText = await extractTextFromPdf(file);
          if (extractedText && extractedText.trim().length > 0) {
            setTextContent(extractedText);
          }
        } catch (pdfErr) {
          console.warn('PDF text extraction error:', pdfErr);
        }
      };
      reader.readAsDataURL(file);
    } else if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          let combinedText = `[File Excel: ${file.name}]\n`;

          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            combinedText += `\n--- Lembar: ${sheetName} ---\n${csv}\n`;
          });

          setTextContent(combinedText);
          const base64Data = btoa(unescape(encodeURIComponent(combinedText)));
          setFileBase64(base64Data);
        } catch (err) {
          console.warn('Excel parse error:', err);
          setTextContent(`[Excel File: ${file.name} - ${(file.size / 1024).toFixed(1)} KB]`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (isTextOrCsv) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        setTextContent(text);
        setFileBase64(btoa(unescape(encodeURIComponent(text))));
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.includes('base64,') ? result.split('base64,')[1] : result;
        setFileBase64(base64Data);
        setTextContent(`[File: ${file.name} - Size: ${(file.size / 1024).toFixed(1)} KB]`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Automated Analysis Trigger
  const handleAnalyze = async () => {
    if (!selectedFile && !textContent) {
      setStatusMessage({ type: 'error', text: 'Silakan pilih atau unggah file dokumen PME terlebih dahulu.' });
      return;
    }

    setIsAnalyzing(true);
    setStatusMessage({ type: 'info', text: 'Sedang menganalisa dokumen PME dengan kecerdasan buatan...' });

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const currentFileName = selectedFile?.name || 'Dokumen_PME.pdf';
    const currentTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    try {
      const response = await fetch('/api/analyze-pme-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: currentFileName,
          mimeType: selectedFile?.type || (selectedFile?.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain'),
          fileBase64,
          textContent,
        }),
      });

      const result = await response.json();

      if (result.success && result.data && result.data.parameters && result.data.parameters.length > 0) {
        const enrichedParams: ParameterEvaluation[] = result.data.parameters.map((p: ParameterEvaluation, idx: number) => ({
          ...p,
          id: `${docId}_${p.id || idx}`,
          documentId: docId,
          sourceFileName: currentFileName,
        }));

        const docRecord: UploadedDocumentRecord = {
          id: docId,
          fileName: currentFileName,
          fileSize: selectedFile?.size,
          uploadedAt: currentTimeStr,
          parameterCount: enrichedParams.length,
          siklusInfo: result.data.header?.siklusInfo || 'Siklus PME 2025',
        };

        onAddDocument(docRecord, result.data.header, enrichedParams, appendMode);
        setStatusMessage({
          type: 'success',
          text: `Berhasil mengekstrak & menganalisa ${enrichedParams.length} parameter dari dokumen "${currentFileName}". Data telah ditambahkan ke tabel evaluasi.`,
        });
        handleClearSelectedFile();
      } else {
        // Try real parsed content from document text first before falling back to domain presets
        const realParsed = extractDataFromRealPmeText(textContent, currentFileName);
        const finalData = realParsed || parseDomainPmeDocument(textContent, currentFileName);

        const enrichedParams: ParameterEvaluation[] = finalData.parameters.map((p, idx) => ({
          ...p,
          id: `${docId}_${p.id || idx}`,
          documentId: docId,
          sourceFileName: currentFileName,
        }));

        const docRecord: UploadedDocumentRecord = {
          id: docId,
          fileName: currentFileName,
          fileSize: selectedFile?.size,
          uploadedAt: currentTimeStr,
          parameterCount: enrichedParams.length,
          siklusInfo: finalData.header.siklusInfo,
        };

        onAddDocument(docRecord, finalData.header, enrichedParams, appendMode);
        setStatusMessage({
          type: 'success',
          text: `Dokumen "${currentFileName}" berhasil dianalisa (${enrichedParams.length} parameter dievaluasi dan ditambahkan ke tabel).`,
        });
        handleClearSelectedFile();
      }
    } catch (err: any) {
      console.warn('Analysis fallback used:', err);
      const realParsed = extractDataFromRealPmeText(textContent, currentFileName);
      const finalData = realParsed || parseDomainPmeDocument(textContent, currentFileName);

      const enrichedParams: ParameterEvaluation[] = finalData.parameters.map((p, idx) => ({
        ...p,
        id: `${docId}_${p.id || idx}`,
        documentId: docId,
        sourceFileName: currentFileName,
      }));

      const docRecord: UploadedDocumentRecord = {
        id: docId,
        fileName: currentFileName,
        fileSize: selectedFile?.size,
        uploadedAt: currentTimeStr,
        parameterCount: enrichedParams.length,
        siklusInfo: finalData.header.siklusInfo,
      };

      onAddDocument(docRecord, finalData.header, enrichedParams, appendMode);
      setStatusMessage({
        type: 'success',
        text: `Dokumen "${currentFileName}" berhasil dianalisa (${enrichedParams.length} parameter ditambahkan).`,
      });
      handleClearSelectedFile();
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Quick Preset Handlers
  const handleLoadSample = (type: 'hemostasis' | 'kimia' | 'urinalisis' | 'siklus1' | 'siklus2') => {
    const docId = `sample_${type}_${Date.now()}`;
    const currentTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (type === 'hemostasis') {
      const sample = hemostasisPreset;
      const fileName = 'Laporan_PME_Hemostasis_Siklus2_2025.pdf';
      const enrichedParams = sample.parameters.map((p, idx) => ({
        ...p,
        id: `${docId}_${p.id || idx}`,
        documentId: docId,
        sourceFileName: fileName,
      }));

      const docRecord: UploadedDocumentRecord = {
        id: docId,
        fileName: fileName,
        uploadedAt: currentTimeStr,
        parameterCount: enrichedParams.length,
        siklusInfo: sample.header.siklusInfo,
      };

      onAddDocument(docRecord, sample.header, enrichedParams, appendMode);
      setStatusMessage({ type: 'success', text: 'Berhasil menambahkan dokumen PME Bidang Hemostasis (PT, APTT, INR, Fibrinogen, TT)!' });
    } else if (type === 'kimia') {
      const sample = kimiaKlinikPreset;
      const fileName = 'Laporan_PME_Kimia_Klinik_Siklus2_2025.xlsx';
      const enrichedParams = sample.parameters.map((p, idx) => ({
        ...p,
        id: `${docId}_${p.id || idx}`,
        documentId: docId,
        sourceFileName: fileName,
      }));

      const docRecord: UploadedDocumentRecord = {
        id: docId,
        fileName: fileName,
        uploadedAt: currentTimeStr,
        parameterCount: enrichedParams.length,
        siklusInfo: sample.header.siklusInfo,
      };

      onAddDocument(docRecord, sample.header, enrichedParams, appendMode);
      setStatusMessage({ type: 'success', text: 'Berhasil menambahkan dokumen PME Bidang Kimia Klinik 2025!' });
    } else if (type === 'urinalisis') {
      const sample = urinalisisPreset;
      const fileName = 'Laporan_PME_Urinalisis_Siklus2_2025.pdf';
      const enrichedParams = sample.parameters.map((p, idx) => ({
        ...p,
        id: `${docId}_${p.id || idx}`,
        documentId: docId,
        sourceFileName: fileName,
      }));

      const docRecord: UploadedDocumentRecord = {
        id: docId,
        fileName: fileName,
        uploadedAt: currentTimeStr,
        parameterCount: enrichedParams.length,
        siklusInfo: sample.header.siklusInfo,
      };

      onAddDocument(docRecord, sample.header, enrichedParams, appendMode);
      setStatusMessage({ type: 'success', text: 'Berhasil menambahkan dokumen PME Bidang Urinalisis 2025!' });
    } else if (type === 'siklus1') {
      const sample = parseDomainPmeDocument('siklus 1 hematologi', 'Hematologi_Siklus1_2025.pdf');
      const fileName = 'Laporan_PME_Hematologi_Siklus1_2025.pdf';
      const enrichedParams = sample.parameters.map((p, idx) => ({
        ...p,
        id: `${docId}_${p.id || idx}`,
        documentId: docId,
        sourceFileName: fileName,
      }));

      const docRecord: UploadedDocumentRecord = {
        id: docId,
        fileName: fileName,
        uploadedAt: currentTimeStr,
        parameterCount: enrichedParams.length,
        siklusInfo: sample.header.siklusInfo,
      };

      onAddDocument(docRecord, sample.header, enrichedParams, appendMode);
      setStatusMessage({ type: 'success', text: 'Berhasil menambahkan dokumen PME Hematologi Siklus 1 2025!' });
    } else {
      const sample = parseDomainPmeDocument('siklus 2 hematologi', 'Hematologi_Siklus2_2025.pdf');
      const fileName = 'Laporan_Hasil_PME_Hematologi_Siklus2_BBLK.pdf';
      const enrichedParams = sample.parameters.map((p, idx) => ({
        ...p,
        id: `${docId}_${p.id || idx}`,
        documentId: docId,
        sourceFileName: fileName,
      }));

      const docRecord: UploadedDocumentRecord = {
        id: docId,
        fileName: fileName,
        uploadedAt: currentTimeStr,
        parameterCount: enrichedParams.length,
        siklusInfo: sample.header.siklusInfo,
      };

      onAddDocument(docRecord, sample.header, enrichedParams, appendMode);
      setStatusMessage({ type: 'success', text: 'Berhasil menambahkan dokumen PME Hematologi Siklus 2 2025!' });
    }
  };

  const handleDeleteDocClick = (doc: UploadedDocumentRecord) => {
    setDocToDelete(doc);
  };

  const handleConfirmDeleteDoc = () => {
    if (docToDelete) {
      const fileName = docToDelete.fileName;
      onDeleteDocument(docToDelete.id);
      setStatusMessage({
        type: 'info',
        text: `Dokumen "${fileName}" dan seluruh parameternya berhasil dihapus dari tabel.`,
      });
      setDocToDelete(null);
    }
  };

  const handleClearAllClick = () => {
    setShowClearAllConfirm(true);
  };

  const handleConfirmClearAll = () => {
    onClearAllDocuments();
    setStatusMessage({
      type: 'info',
      text: 'Semua dokumen dan data parameter telah berhasil dihapus.',
    });
    setShowClearAllConfirm(false);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 sm:p-7 print:hidden space-y-6">
      {/* Upload Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-700" />
            Upload & Otomatisasi Dokumen PME (PDF / Excel / CSV)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Unggah file Lapor Hasil PME berbagai bidang (Hemostasis, Kimia Klinik, Hematologi, Urinalisis) untuk menambahkan data evaluasi otomatis ISO 15189.
          </p>
        </div>

        {/* Multi-Domain Presets buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 font-medium">+ Contoh Domain:</span>
          <button
            onClick={() => handleLoadSample('hemostasis')}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-medium rounded transition-colors cursor-pointer"
            title="Tambahkan data PME Hemostasis (PT, APTT, INR, Fibrinogen, TT)"
          >
            <Droplets className="w-3 h-3 text-rose-600" />
            Hemostasis
          </button>
          <button
            onClick={() => handleLoadSample('kimia')}
            className="px-2.5 py-1 text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-medium rounded transition-colors cursor-pointer"
            title="Tambahkan data PME Kimia Klinik (Glukosa, SGOT, SGPT, Ureum, Kolesterol)"
          >
            Kimia Klinik
          </button>
          <button
            onClick={() => handleLoadSample('urinalisis')}
            className="px-2.5 py-1 text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-medium rounded transition-colors cursor-pointer"
            title="Tambahkan data PME Urinalisis"
          >
            Urinalisis
          </button>
          <button
            onClick={() => handleLoadSample('siklus2')}
            className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded transition-colors cursor-pointer"
            title="Tambahkan data Hematologi Siklus 2"
          >
            Hematologi S-2
          </button>
          <button
            onClick={() => handleLoadSample('siklus1')}
            className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded transition-colors cursor-pointer"
            title="Tambahkan data Hematologi Siklus 1"
          >
            Hematologi S-1
          </button>
        </div>
      </div>

      {/* Drag and drop upload zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg p-6 sm:p-7 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-600 bg-indigo-50/50'
            : selectedFile
            ? 'border-slate-300 bg-slate-50/80 hover:bg-slate-50'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv,.txt"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 mb-1">
            {selectedFile?.name.endsWith('.pdf') ? (
              <FileText className="w-6 h-6 text-red-600" />
            ) : selectedFile?.name.match(/\.xlsx?$|\.csv$/i) ? (
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            ) : (
              <Upload className="w-6 h-6 text-indigo-600" />
            )}
          </div>

          {selectedFile ? (
            <div className="relative w-full">
              <p className="text-xs sm:text-sm font-semibold text-slate-800 font-mono break-all">{selectedFile.name}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Ukuran: {(selectedFile.size / 1024).toFixed(1)} KB &bull; Tipe: {selectedFile.type || 'Dokumen PME'}
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="text-[11px] text-indigo-700 font-medium">Klik untuk ganti file</span>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleClearSelectedFile}
                  className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-800 font-semibold uppercase tracking-wider bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" /> Hapus Pilihan File
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs sm:text-sm font-semibold text-slate-800">
                Tarik & letakkan file dokumen hasil PME (Hemostasis, Kimia, Urinalisis, Hematologi) di sini, atau{' '}
                <span className="text-indigo-700 underline">klik untuk memilih file</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Format didukung: <strong>PDF (.pdf)</strong>, <strong>Excel (.xlsx, .xls)</strong>, <strong>CSV / Teks (.csv, .txt)</strong>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Bar & Options */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={appendMode}
              onChange={(e) => setAppendMode(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <span>
              <strong>Tambahkan data baru</strong> (akumulasi dengan dokumen sebelumnya)
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {selectedFile && (
            <button
              onClick={handleClearSelectedFile}
              className="px-3 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Batal
            </button>
          )}

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || (!selectedFile && !textContent)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Menganalisa & Menambahkan...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Analisa & Tambah ke Tabel</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Feedback Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded text-xs flex items-start gap-2.5 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : statusMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-medium">{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Uploaded Documents List & Management */}
      <div className="border-t border-slate-100 pt-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800">
              Dokumen Terunggah ({uploadedDocs.length}) &bull; Total {totalParametersCount} Parameter
            </h3>
          </div>

          {uploadedDocs.length > 0 && (
            <button
              onClick={handleClearAllClick}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus Semua Dokumen & Data
            </button>
          )}
        </div>

        {uploadedDocs.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
            Belum ada dokumen yang diunggah. Silakan unggah file PDF/Excel/CSV di atas atau pilih contoh domain untuk memulai evaluasi.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {uploadedDocs.map((doc, idx) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 transition-all text-xs"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-2 rounded bg-white border border-slate-200 text-slate-700 shrink-0 mt-0.5">
                    {doc.fileName.endsWith('.pdf') ? (
                      <FileText className="w-4 h-4 text-red-600" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate" title={doc.fileName}>
                      {idx + 1}. {doc.fileName}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                        {doc.parameterCount} Parameter
                      </span>
                      <span>&bull;</span>
                      <span>Diunggah {doc.uploadedAt}</span>
                    </div>
                    {doc.siklusInfo && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{doc.siklusInfo}</p>
                    )}
                  </div>
                </div>

                <div className="ml-2 shrink-0">
                  <button
                    onClick={() => handleDeleteDocClick(doc)}
                    className="inline-flex items-center gap-1 p-2 text-red-600 hover:text-white hover:bg-red-600 rounded border border-red-200 hover:border-red-600 transition-colors cursor-pointer"
                    title={`Hapus dokumen ${doc.fileName} dan parameternya`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider hidden sm:inline">Hapus</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={!!docToDelete}
        title="Hapus Dokumen PME?"
        message={`Apakah Anda yakin ingin menghapus dokumen "${docToDelete?.fileName}" dan seluruh (${docToDelete?.parameterCount || 0}) parameternya dari daftar evaluasi?`}
        confirmLabel="Ya, Hapus Dokumen"
        cancelLabel="Batal"
        onConfirm={handleConfirmDeleteDoc}
        onCancel={() => setDocToDelete(null)}
      />

      <ConfirmModal
        isOpen={showClearAllConfirm}
        title="Hapus Semua Dokumen & Parameter?"
        message="Tindakan ini akan mengosongkan seluruh tabel evaluasi dan menghapus semua dokumen yang telah diunggah."
        confirmLabel="Ya, Kosongkan Semua"
        cancelLabel="Batal"
        onConfirm={handleConfirmClearAll}
        onCancel={() => setShowClearAllConfirm(false)}
      />
    </section>
  );
};
