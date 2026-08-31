import React from 'react';
import { ParameterEvaluation } from '../types';
import { CheckCircle2, AlertTriangle, XCircle, FileText, Award } from 'lucide-react';

interface SummaryMetricsProps {
  parameters: ParameterEvaluation[];
}

export const SummaryMetrics: React.FC<SummaryMetricsProps> = ({ parameters }) => {
  const total = parameters.length;
  const memuaskan = parameters.filter((p) => p.statusOverall === 'Memuaskan').length;
  const peringatan = parameters.filter((p) => p.statusOverall === 'Peringatan').length;
  const kurang = parameters.filter((p) => p.statusOverall === 'Kurang Memuaskan').length;

  const scorePct = Math.round(((memuaskan + peringatan) / (total || 1)) * 100);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Parameter</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{total}</span>
            <span className="text-xs text-slate-500 font-medium">100%</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Kategori Memuaskan</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700">{memuaskan}</span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {Math.round((memuaskan / total) * 100)}%
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Kategori Peringatan ($)</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-700">{peringatan}</span>
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              MCV
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Kurang Memuaskan ($$)</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-red-700">{kurang}</span>
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
              MCH
            </span>
          </div>
        </div>
      </div>

      {/* Clean Minimalism Dark Summary Banner */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center rounded-lg shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Skor Akumulasi Mutu</span>
            <span className="text-3xl font-light font-mono italic text-emerald-400 underline underline-offset-4 mt-0.5">
              {scorePct}%
            </span>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Predikat Penilaian Mutu PME</p>
          <p className="text-base sm:text-lg font-bold tracking-tight uppercase text-white mt-0.5">
            Sangat Memuaskan (AKSEPTABEL)
          </p>
        </div>
      </div>
    </div>
  );
};

