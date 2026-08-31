import React from 'react';
import { PmeDocumentHeader } from '../types';
import { Printer, Download, FileDown, LayoutList, Table, RotateCcw, FileCheck, PenTool } from 'lucide-react';

interface HeaderCardProps {
  header: PmeDocumentHeader;
  viewMode: 'official' | 'interactive';
  onToggleViewMode: (mode: 'official' | 'interactive') => void;
  onPrintPDF: () => void;
  onDownloadPDF: () => void;
  onExportCSV: () => void;
  onResetData: () => void;
  onToggleSignatoryPanel?: () => void;
  isSignatoryPanelOpen?: boolean;
  isDownloadingPdf?: boolean;
}

export const HeaderCard: React.FC<HeaderCardProps> = ({
  header,
  viewMode,
  onToggleViewMode,
  onPrintPDF,
  onDownloadPDF,
  onExportCSV,
  onResetData,
  onToggleSignatoryPanel,
  isSignatoryPanelOpen = false,
  isDownloadingPdf = false,
}) => {
  return (
    <header className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 sm:p-8 flex flex-col gap-6 print:hidden">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            <FileCheck className="w-3.5 h-3.5 text-slate-600" />
            Laporan Evaluasi Capaian Parameter PME
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 uppercase">
            {header.judulDoc}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 uppercase tracking-wider font-medium">
            {header.siklusInfo}
          </p>
        </div>

        {/* Action Controls & View Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-md border border-slate-200 flex items-center">
            <button
              onClick={() => onToggleViewMode('official')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all ${
                viewMode === 'official'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Table className="w-3.5 h-3.5" /> Format Resmi (File 2)
            </button>
            <button
              onClick={() => onToggleViewMode('interactive')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all ${
                viewMode === 'interactive'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" /> Tabel Interaktif
            </button>
          </div>

          {onToggleSignatoryPanel && (
            <button
              onClick={onToggleSignatoryPanel}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm cursor-pointer ${
                isSignatoryPanelOpen
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
              }`}
              title="Atur Penandatangan Laporan"
            >
              <PenTool className="w-3.5 h-3.5" />
              Penandatangan ({header.signatories?.length || 1})
            </button>
          )}

          <button
            onClick={onPrintPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
            title="Buka Dialog Cetak / Print PDF"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak PDF
          </button>

          <button
            onClick={onDownloadPDF}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            title="Unduh File PDF Laporan Evaluasi PME"
          >
            <FileDown className="w-3.5 h-3.5" />
            {isDownloadingPdf ? 'Mengunduh...' : 'Unduh PDF'}
          </button>

          <button
            onClick={onExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            title="Unduh Data Format Excel / CSV"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>

          <button
            onClick={onResetData}
            className="inline-flex items-center gap-1.5 p-2 text-slate-400 hover:text-slate-700 border border-slate-200 rounded hover:bg-slate-50 transition-colors cursor-pointer"
            title="Reset ke Data Awal File 1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Metadata Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="flex flex-col p-3 bg-slate-50 rounded border border-slate-200">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Penyelenggara PME</span>
          <span className="text-sm font-semibold text-slate-900 mt-0.5">{header.pmeOrganizer}</span>
        </div>

        <div className="flex flex-col p-3 bg-slate-50 rounded border border-slate-200">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Fasilitas Peserta</span>
          <span className="text-sm font-semibold text-slate-900 mt-0.5">{header.namaPeserta} <span className="font-mono text-slate-500">({header.kodePeserta})</span></span>
        </div>

        <div className="flex flex-col p-3 bg-slate-50 rounded border border-slate-200">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Tanggal Evaluasi</span>
          <span className="text-sm font-semibold text-slate-900 mt-0.5">{header.tanggalHasil}</span>
        </div>
      </div>
    </header>
  );
};

