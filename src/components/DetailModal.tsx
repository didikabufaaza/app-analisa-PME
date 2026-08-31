import React from 'react';
import { ParameterEvaluation } from '../types';
import { X, Activity } from 'lucide-react';

interface DetailModalProps {
  parameter: ParameterEvaluation | null;
  onClose: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ parameter, onClose }) => {
  if (!parameter) return null;

  const renderGroupRow = (groupName: string, data: any) => {
    return (
      <tr className="border-b border-slate-200 hover:bg-slate-50 text-xs">
        <td className="p-2.5 font-semibold text-slate-800">{groupName}</td>
        <td className="p-2.5 text-center text-slate-600 font-mono">{data.n}</td>
        <td className="p-2.5 text-center font-mono font-medium text-slate-900">{data.target}</td>
        <td
          className={`p-2.5 text-center font-mono font-bold ${
            data.kategori === '$$'
              ? 'text-red-700'
              : data.kategori === '$'
              ? 'text-amber-700'
              : 'text-emerald-700'
          }`}
        >
          {data.zScore}
        </td>
        <td className="p-2.5 text-center font-semibold font-mono">{data.kategori}</td>
        <td className="p-2.5 text-center">
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
              data.keterangan === 'Kurang Memuaskan'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : data.keterangan === 'Peringatan'
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : data.keterangan === 'Memuaskan'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {data.keterangan}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 w-full max-w-3xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded border border-slate-700">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold uppercase tracking-wider">Rincian Z-Score: {parameter.parameterName}</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Metode: {parameter.kodeMetode} | Alat: {parameter.kodeAlat} | Satuan: {parameter.unit}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Botol 1 Table */}
          <div>
            <div className="flex items-center justify-between mb-2 border-b border-slate-200 pb-2">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                Botol 1 (Kadar Normal) - Hasil Lab:
                <span className="text-slate-900 font-bold font-mono">{parameter.botol1.hasilSaudara} {parameter.unit}</span>
              </h4>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                {parameter.botol1.overallStatus}
              </span>
            </div>

            <table className="w-full text-left border border-slate-200 rounded overflow-hidden">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-[11px] font-bold border-b border-slate-200 uppercase tracking-wider">
                  <th className="p-2.5">Kelompok Evaluasi</th>
                  <th className="p-2.5 text-center">Jumlah (n)</th>
                  <th className="p-2.5 text-center">Nilai Target</th>
                  <th className="p-2.5 text-center">Z Score</th>
                  <th className="p-2.5 text-center">Kategori</th>
                  <th className="p-2.5 text-center">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {renderGroupRow('Seluruh Peserta', parameter.botol1.seluruh)}
                {renderGroupRow('Kelompok Metode', parameter.botol1.kelompokMetode)}
                {renderGroupRow('Kelompok Alat', parameter.botol1.kelompokAlat)}
              </tbody>
            </table>
          </div>

          {/* Botol 2 Table */}
          <div>
            <div className="flex items-center justify-between mb-2 border-b border-slate-200 pb-2">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                Botol 2 (Kadar Patologis) - Hasil Lab:
                <span className="text-slate-900 font-bold font-mono">{parameter.botol2.hasilSaudara} {parameter.unit}</span>
              </h4>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                {parameter.botol2.overallStatus}
              </span>
            </div>

            <table className="w-full text-left border border-slate-200 rounded overflow-hidden">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-[11px] font-bold border-b border-slate-200 uppercase tracking-wider">
                  <th className="p-2.5">Kelompok Evaluasi</th>
                  <th className="p-2.5 text-center">Jumlah (n)</th>
                  <th className="p-2.5 text-center">Nilai Target</th>
                  <th className="p-2.5 text-center">Z Score</th>
                  <th className="p-2.5 text-center">Kategori</th>
                  <th className="p-2.5 text-center">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {renderGroupRow('Seluruh Peserta', parameter.botol2.seluruh)}
                {renderGroupRow('Kelompok Metode', parameter.botol2.kelompokMetode)}
                {renderGroupRow('Kelompok Alat', parameter.botol2.kelompokAlat)}
              </tbody>
            </table>
          </div>

          {/* Corrective Plan */}
          <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-1.5">
            <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rencana Perbaikan Evaluasi</h5>
            <p className="text-xs text-slate-800 leading-relaxed font-sans">{parameter.rencanaPerbaikan}</p>
            <p className="text-xs text-slate-500 font-semibold pt-1">PJ: {parameter.penanggungJawab}</p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-semibold uppercase tracking-wider hover:bg-slate-800 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

