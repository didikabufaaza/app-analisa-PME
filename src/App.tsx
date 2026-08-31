import React, { useState } from 'react';
import { initialHeader, initialParameters } from './data/pmeData';
import { ParameterEvaluation, PmeDocumentHeader, UploadedDocumentRecord } from './types';
import { HeaderCard } from './components/HeaderCard';
import { DocumentUploadSection } from './components/DocumentUploadSection';
import { SignatorySettingsCard } from './components/SignatorySettingsCard';
import { SummaryMetrics } from './components/SummaryMetrics';
import { OfficialTable } from './components/OfficialTable';
import { InteractiveTable } from './components/InteractiveTable';
import { DetailModal } from './components/DetailModal';
import { CapaModal } from './components/CapaModal';
import { ConfirmModal } from './components/ConfirmModal';
import { getSavedSignatoryConfig } from './utils/signatoryStorage';
import { exportPmeToExcel } from './utils/excelExport';
import { downloadPmeAsPdf } from './utils/pdfExport';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const initialDocRecord: UploadedDocumentRecord = {
  id: 'doc_initial',
  fileName: 'Laporan_Evaluasi_PME_Hematologi_BBLK_2025.pdf',
  uploadedAt: 'Bawaan Awal',
  parameterCount: initialParameters.length,
  siklusInfo: initialHeader.siklusInfo,
};

const initialParametersWithDoc: ParameterEvaluation[] = initialParameters.map((p) => ({
  ...p,
  documentId: 'doc_initial',
  sourceFileName: 'Laporan_Evaluasi_PME_Hematologi_BBLK_2025.pdf',
}));

const getInitialHeaderWithSavedSignatories = (): PmeDocumentHeader => {
  const saved = getSavedSignatoryConfig();
  if (saved && saved.signatories && saved.signatories.length > 0) {
    return {
      ...initialHeader,
      signatories: saved.signatories,
      signatoryLayout: saved.signatoryLayout,
      ketuaTimKerja: saved.ketuaTimKerja,
      nipKetua: saved.nipKetua,
      kotaDokumen: saved.kotaDokumen || initialHeader.kotaDokumen,
    };
  }
  return initialHeader;
};

export default function App() {
  const [header, setHeader] = useState<PmeDocumentHeader>(getInitialHeaderWithSavedSignatories);
  const [parameters, setParameters] = useState<ParameterEvaluation[]>(initialParametersWithDoc);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocumentRecord[]>([initialDocRecord]);
  const [viewMode, setViewMode] = useState<'official' | 'interactive'>('official');
  const [isSignatoryPanelOpen, setIsSignatoryPanelOpen] = useState<boolean>(false);
  const [selectedParam, setSelectedParam] = useState<ParameterEvaluation | null>(null);
  const [capaParam, setCapaParam] = useState<ParameterEvaluation | null>(null);
  const [paramToDelete, setParamToDelete] = useState<ParameterEvaluation | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  const handleUpdateParameter = (updatedParam: ParameterEvaluation) => {
    setParameters((prev) =>
      prev.map((p) => (p.id === updatedParam.id ? updatedParam : p))
    );
  };

  const handleApplyCapa = (paramId: string, newRencana: string) => {
    setParameters((prev) =>
      prev.map((p) => (p.id === paramId ? { ...p, rencanaPerbaikan: newRencana } : p))
    );
  };

  // Add new document and accumulate parameters
  const handleAddDocument = (
    docRecord: UploadedDocumentRecord,
    newHeader: PmeDocumentHeader,
    newParams: ParameterEvaluation[],
    appendMode: boolean
  ) => {
    if (newHeader) {
      const saved = getSavedSignatoryConfig();
      if (saved && saved.signatories && saved.signatories.length > 0) {
        setHeader({
          ...newHeader,
          signatories: saved.signatories,
          signatoryLayout: saved.signatoryLayout,
          ketuaTimKerja: saved.ketuaTimKerja,
          nipKetua: saved.nipKetua,
          kotaDokumen: saved.kotaDokumen || newHeader.kotaDokumen,
        });
      } else {
        setHeader(newHeader);
      }
    }

    if (appendMode) {
      setParameters((prev) => {
        const combined = [...prev, ...newParams];
        // Re-index all numbers sequentially
        return combined.map((p, idx) => ({ ...p, no: idx + 1 }));
      });
      setUploadedDocs((prev) => {
        const filtered = prev.filter((d) => d.id !== docRecord.id);
        return [...filtered, docRecord];
      });
    } else {
      setParameters(newParams.map((p, idx) => ({ ...p, no: idx + 1 })));
      setUploadedDocs([docRecord]);
    }
  };

  // Delete a specific document and all its parameters
  const handleDeleteDocument = (docId: string) => {
    setParameters((prev) => {
      const remaining = prev.filter((p) => p.documentId !== docId);
      return remaining.map((p, idx) => ({ ...p, no: idx + 1 }));
    });
    setUploadedDocs((prev) => prev.filter((d) => d.id !== docId));
  };

  // Trigger delete parameter modal
  const handleDeleteParameter = (paramId: string) => {
    const target = parameters.find((p) => p.id === paramId);
    if (target) {
      setParamToDelete(target);
    }
  };

  // Confirm single parameter deletion
  const handleConfirmDeleteParameter = () => {
    if (!paramToDelete) return;
    const targetId = paramToDelete.id;
    const targetDocId = paramToDelete.documentId;

    const remaining = parameters.filter((p) => p.id !== targetId);
    const reindexed = remaining.map((p, idx) => ({ ...p, no: idx + 1 }));
    setParameters(reindexed);

    if (targetDocId) {
      setUploadedDocs((prevDocs) => {
        return prevDocs
          .map((doc) => {
            if (doc.id === targetDocId) {
              const count = reindexed.filter((p) => p.documentId === targetDocId).length;
              return { ...doc, parameterCount: count };
            }
            return doc;
          })
          .filter((doc) => doc.parameterCount > 0);
      });
    }

    setParamToDelete(null);
  };

  // Clear all documents and parameters
  const handleClearAllDocuments = () => {
    setParameters([]);
    setUploadedDocs([]);
  };

  const handleResetData = () => {
    setIsResetConfirmOpen(true);
  };

  const handleConfirmResetData = () => {
    setParameters(initialParametersWithDoc);
    setUploadedDocs([initialDocRecord]);
    const saved = getSavedSignatoryConfig();
    if (saved && saved.signatories && saved.signatories.length > 0) {
      setHeader({
        ...initialHeader,
        signatories: saved.signatories,
        signatoryLayout: saved.signatoryLayout,
        ketuaTimKerja: saved.ketuaTimKerja,
        nipKetua: saved.nipKetua,
        kotaDokumen: saved.kotaDokumen || initialHeader.kotaDokumen,
      });
    } else {
      setHeader(initialHeader);
    }
    setIsResetConfirmOpen(false);
  };

  const [appToast, setAppToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showAppToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setAppToast({ message, type });
    setTimeout(() => setAppToast(null), 4000);
  };

  // 1. Print PDF (Opens Browser Print Preview with clean A4 layout)
  const handlePrintPDF = () => {
    if (viewMode !== 'official') {
      setViewMode('official');
      setTimeout(() => {
        window.print();
      }, 300);
    } else {
      window.print();
    }
  };

  // 2. Direct Download PDF File
  const handleDownloadPDF = async () => {
    setIsDownloadingPdf(true);
    const originalViewMode = viewMode;
    try {
      if (viewMode !== 'official') {
        setViewMode('official');
        await new Promise((res) => setTimeout(res, 350));
      }

      await downloadPmeAsPdf(header, 'pme-official-report');
      showAppToast('File PDF Laporan Evaluasi PME berhasil diunduh.', 'success');
    } catch (err) {
      console.error('Gagal membuat PDF:', err);
      showAppToast('Gagal mengunduh PDF secara langsung. Silakan gunakan tombol "Cetak PDF".', 'error');
    } finally {
      if (originalViewMode !== 'official') {
        setViewMode(originalViewMode);
      }
      setIsDownloadingPdf(false);
    }
  };

  // 3. Export Excel (.xls) matching exact 5 output table columns & formatting
  const handleExportCSV = () => {
    const success = exportPmeToExcel(header, parameters);
    if (success) {
      showAppToast('File Excel Laporan Evaluasi PME (.xls) berhasil diunduh.', 'success');
    } else {
      showAppToast('Gagal mengekspor data ke Excel.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-3 sm:p-6 md:p-8 selection:bg-slate-200">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Card & View Actions */}
        <HeaderCard
          header={header}
          viewMode={viewMode}
          onToggleViewMode={setViewMode}
          onPrintPDF={handlePrintPDF}
          onDownloadPDF={handleDownloadPDF}
          onExportCSV={handleExportCSV}
          onResetData={handleResetData}
          onToggleSignatoryPanel={() => setIsSignatoryPanelOpen((prev) => !prev)}
          isSignatoryPanelOpen={isSignatoryPanelOpen}
          isDownloadingPdf={isDownloadingPdf}
        />

        {/* Upload & Automatic Document Analysis Section with Multi-document accumulation */}
        <DocumentUploadSection
          onDataLoaded={(newH, newP) => handleAddDocument({
            id: `doc_${Date.now()}`,
            fileName: 'Dokumen_Upload.pdf',
            uploadedAt: new Date().toLocaleDateString('id-ID'),
            parameterCount: newP.length,
          }, newH, newP, true)}
          onAddDocument={handleAddDocument}
          uploadedDocs={uploadedDocs}
          onDeleteDocument={handleDeleteDocument}
          onClearAllDocuments={handleClearAllDocuments}
          totalParametersCount={parameters.length}
        />

        {/* Dedicated Signatory Settings & Input Form Panel */}
        <SignatorySettingsCard
          header={header}
          onUpdateHeader={setHeader}
          isOpenDefault={isSignatoryPanelOpen}
        />

        {/* Quality Metrics Cards */}
        <div className="print:hidden">
          <SummaryMetrics parameters={parameters} />
        </div>

        {/* Primary View Output */}
        <main className="transition-all">
          {viewMode === 'official' ? (
            <OfficialTable
              header={header}
              parameters={parameters}
              onGenerateCapa={setCapaParam}
              onDeleteParameter={handleDeleteParameter}
              onOpenSignatoryEditor={() => setIsSignatoryPanelOpen(true)}
            />
          ) : (
            <InteractiveTable
              parameters={parameters}
              onUpdateParameter={handleUpdateParameter}
              onSelectParameter={setSelectedParam}
              onGenerateCapa={setCapaParam}
              onDeleteParameter={handleDeleteParameter}
            />
          )}
        </main>
      </div>

      {/* Toast Notification for Export & PDF Actions */}
      {appToast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-xs font-semibold tracking-wide print:hidden animate-fade-in transition-all ${
            appToast.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : appToast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {appToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{appToast.message}</span>
        </div>
      )}

      {/* Modals */}
      <DetailModal parameter={selectedParam} onClose={() => setSelectedParam(null)} />
      <CapaModal
        parameter={capaParam}
        onClose={() => setCapaParam(null)}
        onApplyCapa={handleApplyCapa}
      />

      {/* Delete Parameter Confirmation Modal */}
      <ConfirmModal
        isOpen={!!paramToDelete}
        title="Hapus Parameter Evaluasi?"
        message={`Apakah Anda yakin ingin menghapus parameter "${paramToDelete?.parameterName}" dari daftar evaluasi PME?`}
        confirmLabel="Ya, Hapus Parameter"
        cancelLabel="Batal"
        onConfirm={handleConfirmDeleteParameter}
        onCancel={() => setParamToDelete(null)}
      />

      {/* Reset Initial Data Confirmation Modal */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Kembalikan ke Data Awal?"
        message="Tindakan ini akan mengembalikan data evaluasi ke format default bawaan (Laporan Evaluasi Hematologi BBLK)."
        confirmLabel="Ya, Reset Data"
        cancelLabel="Batal"
        isDestructive={false}
        onConfirm={handleConfirmResetData}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
}

