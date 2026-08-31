import React from 'react';
import { ParameterEvaluation, PmeDocumentHeader, SignatoryItem } from '../types';
import { Sparkles, Trash2, FileText, PenTool } from 'lucide-react';

interface OfficialTableProps {
  header: PmeDocumentHeader;
  parameters: ParameterEvaluation[];
  showSignature?: boolean;
  onGenerateCapa?: (param: ParameterEvaluation) => void;
  onDeleteParameter?: (paramId: string) => void;
  onOpenSignatoryEditor?: () => void;
}

export const OfficialTable: React.FC<OfficialTableProps> = ({
  header,
  parameters,
  showSignature = true,
  onGenerateCapa,
  onDeleteParameter,
  onOpenSignatoryEditor,
}) => {
  const signatories: SignatoryItem[] =
    header.signatories && header.signatories.length > 0
      ? header.signatories
      : [
          {
            id: 'default-sig',
            roleTitle: 'Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan',
            name: header.ketuaTimKerja || 'dr. Lisa Dewi, MKes',
            nipOrId: header.nipKetua || '196907172001122001',
            locationAndDate: `Palembang, ${header.tanggalHasil || '14 November 2025'}`,
            signStyle: 'cursive',
          },
        ];

  const layout = header.signatoryLayout || (signatories.length > 1 ? 'dual' : 'single-right');
  return (
    <div
      id="pme-official-report"
      className="bg-white text-slate-800 font-sans p-6 sm:p-10 shadow-sm rounded-lg border border-slate-200 print:shadow-none print:border-none print:p-0 max-w-5xl mx-auto"
    >
      {/* Official Header matching Document 2 & Clean Minimalism */}
      <div className="mb-6 border-b border-slate-200 pb-5 print:mb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 uppercase">
          {header.judulDoc}
        </h1>
        <div className="mt-3 space-y-1 text-xs sm:text-sm font-semibold text-slate-700 uppercase tracking-wider">
          <p>
            <span className="inline-block w-36 text-slate-400 font-medium">PME</span>: {header.pmeOrganizer}
          </p>
          <p>
            <span className="inline-block w-36 text-slate-400 font-medium">Tanggal Hasil</span>: {header.tanggalHasil}
          </p>
          {header.namaPeserta && (
            <p>
              <span className="inline-block w-36 text-slate-400 font-medium">Peserta</span>: {header.namaPeserta} ({header.kodePeserta})
            </p>
          )}
        </div>
      </div>

      {/* Main Table exact matching File 2 structure */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse border border-slate-200 text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <th className="border border-slate-200 px-3 py-3 text-center w-12">No.</th>
              <th className="border border-slate-200 px-3 py-3 w-1/4">Sasaran</th>
              <th className="border border-slate-200 px-3 py-3 w-1/3">Hasil Pencapain</th>
              <th className="border border-slate-200 px-3 py-3 w-1/3">Rencana Perbaikan</th>
              <th className="border border-slate-200 px-3 py-3 w-1/6">Penanggung Jawab</th>
            </tr>
          </thead>
          <tbody>
            {parameters.length === 0 ? (
              <tr>
                <td colSpan={5} className="border border-slate-200 p-8 text-center text-slate-400 text-xs">
                  Belum ada parameter evaluasi PME yang dimuat. Silakan unggah dokumen di atas.
                </td>
              </tr>
            ) : (
              parameters.map((param) => {
                const isWarning = param.statusOverall === 'Peringatan';
                const isUnsatisfactory = param.statusOverall === 'Kurang Memuaskan';

                return (
                  <React.Fragment key={param.id}>
                    {/* Parameter Group Sub-Header */}
                    <tr className="bg-indigo-50/40 border-t border-b border-slate-200">
                      <td className="border border-slate-200 px-3 py-2 text-center bg-indigo-100/60 font-bold text-slate-700">
                        {param.no}
                      </td>
                      <td colSpan={4} className="border border-slate-200 px-3 py-2 uppercase tracking-wide">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-indigo-900 text-xs sm:text-sm">
                              PARAMETER: {param.parameterName}
                              <span className="text-slate-500 font-medium normal-case text-xs ml-2">
                                (Kode Metode: {param.kodeMetode}, Kode Alat: {param.kodeAlat})
                              </span>
                            </span>
                            {param.sourceFileName && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded font-normal normal-case print:hidden">
                                <FileText className="w-3 h-3 text-indigo-500" />
                                {param.sourceFileName}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[11px] px-2.5 py-0.5 rounded font-semibold border uppercase tracking-wider ${
                                isUnsatisfactory
                                  ? 'bg-red-50 text-red-800 border-red-200'
                                  : isWarning
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              Status: {param.statusOverall}
                            </span>

                            {onDeleteParameter && (
                              <button
                                onClick={() => onDeleteParameter(param.id)}
                                className="print:hidden p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                                title={`Hapus parameter ${param.parameterName}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Main Evaluation Row matching File 2 format */}
                    <tr className="hover:bg-slate-50/80 transition-colors align-top border-b border-slate-200">
                      <td className="border border-slate-200 px-2 py-3 text-center text-slate-400 font-mono text-xs">
                        {param.no}
                      </td>
                      <td className="border border-slate-200 px-3 py-3 font-medium text-slate-800 leading-relaxed">
                        {param.sasaran}
                      </td>
                      <td className="border border-slate-200 px-3 py-3 text-slate-800 space-y-2">
                        <div className="p-2.5 bg-slate-50/70 rounded border border-slate-200 text-xs">
                          <div className="font-semibold text-slate-900 border-b border-slate-200 pb-1 mb-1 flex justify-between">
                            <span>Botol 1 (Kadar Normal)</span>
                            <span
                              className={
                                param.botol1.overallStatus === 'Kurang Memuaskan'
                                  ? 'text-red-700 font-bold'
                                  : param.botol1.overallStatus === 'Peringatan'
                                  ? 'text-amber-700 font-bold'
                                  : 'text-emerald-700 font-semibold'
                              }
                            >
                              [{param.botol1.overallStatus}]
                            </span>
                          </div>
                          <p className="text-slate-700">Hasil: <strong className="text-slate-900 font-bold">{param.botol1.hasilSaudara}</strong> {param.unit}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Z-Score: Seluruh {param.botol1.seluruh.zScore} ({param.botol1.seluruh.keterangan}) | Metode {param.botol1.kelompokMetode.zScore} ({param.botol1.kelompokMetode.keterangan}) | Alat {param.botol1.kelompokAlat.zScore} ({param.botol1.kelompokAlat.keterangan})
                          </p>
                        </div>

                        <div className="p-2.5 bg-slate-50/70 rounded border border-slate-200 text-xs">
                          <div className="font-semibold text-slate-900 border-b border-slate-200 pb-1 mb-1 flex justify-between">
                            <span>Botol 2 (Kadar Patologis/Tinggi)</span>
                            <span
                              className={
                                param.botol2.overallStatus === 'Kurang Memuaskan'
                                  ? 'text-red-700 font-bold'
                                  : param.botol2.overallStatus === 'Peringatan'
                                  ? 'text-amber-700 font-bold'
                                  : 'text-emerald-700 font-semibold'
                              }
                            >
                              [{param.botol2.overallStatus}]
                            </span>
                          </div>
                          <p className="text-slate-700">Hasil: <strong className="text-slate-900 font-bold">{param.botol2.hasilSaudara}</strong> {param.unit}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Z-Score: Seluruh {param.botol2.seluruh.zScore} ({param.botol2.seluruh.keterangan}) | Metode {param.botol2.kelompokMetode.zScore} ({param.botol2.kelompokMetode.keterangan}) | Alat {param.botol2.kelompokAlat.zScore} ({param.botol2.kelompokAlat.keterangan})
                          </p>
                        </div>
                      </td>
                      <td
                        className={`border border-slate-200 px-3 py-3 leading-relaxed text-xs ${
                          isUnsatisfactory
                            ? 'bg-red-50/40 text-red-950 font-medium'
                            : isWarning
                            ? 'bg-amber-50/40 text-amber-950'
                            : 'text-slate-700'
                        }`}
                      >
                        <p>{param.rencanaPerbaikan}</p>
                        {onGenerateCapa && (
                          <div className="mt-2 print:hidden">
                            <button
                              onClick={() => onGenerateCapa(param)}
                              className="inline-flex items-center gap-1 text-[10px] text-slate-700 hover:text-black font-semibold uppercase tracking-wider bg-white hover:bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shadow-2xs transition-all cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3 text-indigo-600" /> AI CAPA
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-200 px-3 py-3 text-slate-900 font-semibold text-xs">
                        {param.penanggungJawab}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Signature Section */}
      {showSignature && (
        <div className="mt-8 pt-4 border-t border-slate-100 print:border-none print:mt-10 print:break-inside-avoid">
          {/* Quick Edit Signatory Button (Hidden in Print) */}
          {onOpenSignatoryEditor && (
            <div className="flex justify-end mb-3 print:hidden">
              <button
                type="button"
                onClick={onOpenSignatoryEditor}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors shadow-2xs cursor-pointer"
                title="Buka Pengaturan & Input Kolom Penandatangan"
              >
                <PenTool className="w-3.5 h-3.5" /> Sesuaikan / Ganti Penandatangan ({signatories.length} Kolom)
              </button>
            </div>
          )}

          <div
            className={`w-full ${
              layout === 'single-left'
                ? 'flex justify-start'
                : layout === 'dual'
                ? 'grid grid-cols-1 sm:grid-cols-2 gap-8 justify-between'
                : layout === 'triple'
                ? 'grid grid-cols-1 sm:grid-cols-3 gap-6 justify-between'
                : 'flex justify-end'
            }`}
          >
            {signatories.map((sig, idx) => {
              return (
                <div
                  key={sig.id || idx}
                  className={`text-center min-w-[240px] max-w-xs ${
                    layout === 'single-right' ? 'ml-auto' : ''
                  }`}
                >
                  {/* Lokasi & Tanggal (hanya jika diisi) */}
                  <p className="text-xs text-slate-700 min-h-[1.2rem]">
                    {sig.locationAndDate ? sig.locationAndDate : '\u00A0'}
                  </p>

                  {/* Jabatan */}
                  <p className="font-semibold text-xs mt-1 uppercase tracking-wider text-slate-800 whitespace-pre-line leading-relaxed min-h-[2.5rem] flex items-center justify-center">
                    {sig.roleTitle}
                  </p>

                    {/* Signature Area */}
                    <div className="h-20 my-2 flex items-center justify-center">
                      {sig.signStyle === 'image' && sig.customSignatureImage ? (
                        <img
                          src={sig.customSignatureImage}
                          alt={`Tanda Tangan ${sig.name}`}
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          className="max-h-16 max-w-[160px] object-contain"
                        />
                      ) : sig.signStyle === 'plain' ? (
                        <div className="h-12 border-b border-dashed border-slate-300 w-36" />
                      ) : (
                        <span className="font-serif italic text-slate-800 text-2xl font-bold opacity-85 select-none">
                          ~ {sig.name} ~
                        </span>
                      )}
                    </div>

                  {/* Nama Lengkap & NIP */}
                  <p className="font-bold underline text-xs text-slate-900 leading-normal">
                    {sig.name}
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono mt-0.5">
                    {sig.nipOrId
                      ? sig.nipOrId.startsWith('NIP') || sig.nipOrId.startsWith('SIP') || sig.nipOrId === '-'
                        ? sig.nipOrId
                        : `NIP ${sig.nipOrId}`
                      : '-'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer watermark */}
      <div className="mt-8 text-center text-[10px] text-slate-400 border-t border-slate-200 pt-3 uppercase tracking-wider print:mt-6">
        Dokumen Laporan Evaluasi PME Resmi {header.pmeOrganizer || 'Laboratorium Kesehatan'}
      </div>
    </div>
  );
};

