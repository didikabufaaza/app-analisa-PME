import React, { useState } from 'react';
import { ParameterEvaluation, StatusCategory } from '../types';
import { Search, Sparkles, Edit3, CheckCircle2, AlertTriangle, XCircle, Info, Trash2, FileText } from 'lucide-react';

interface InteractiveTableProps {
  parameters: ParameterEvaluation[];
  onUpdateParameter: (updatedParam: ParameterEvaluation) => void;
  onSelectParameter: (param: ParameterEvaluation) => void;
  onGenerateCapa: (param: ParameterEvaluation) => void;
  onDeleteParameter?: (paramId: string) => void;
}

export const InteractiveTable: React.FC<InteractiveTableProps> = ({
  parameters,
  onUpdateParameter,
  onSelectParameter,
  onGenerateCapa,
  onDeleteParameter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRencana, setEditRencana] = useState('');
  const [editPJ, setEditPJ] = useState('');

  const filteredParams = parameters.filter((p) => {
    const matchesSearch =
      p.parameterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.kodeMetode.includes(searchQuery) ||
      p.kodeAlat.includes(searchQuery);

    if (selectedFilter === 'ALL') return matchesSearch;
    return matchesSearch && p.statusOverall === selectedFilter;
  });

  const handleStartEdit = (p: ParameterEvaluation) => {
    setEditingId(p.id);
    setEditRencana(p.rencanaPerbaikan);
    setEditPJ(p.penanggungJawab);
  };

  const handleSaveEdit = (p: ParameterEvaluation) => {
    onUpdateParameter({
      ...p,
      rencanaPerbaikan: editRencana,
      penanggungJawab: editPJ,
    });
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const getStatusBadge = (status: StatusCategory) => {
    switch (status) {
      case 'Memuaskan':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Memuaskan
          </span>
        );
      case 'Peringatan':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Peringatan ($)
          </span>
        );
      case 'Kurang Memuaskan':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-red-50 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3 text-red-600" />
            Kurang Memuaskan ($$)
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Search and Filters Bar */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari parameter (Hb, WBC, MCH, MCV)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filter Status:</span>
          {['ALL', 'Memuaskan', 'Peringatan', 'Kurang Memuaskan'].map((filter) => {
            const isActive = selectedFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-3 py-1 rounded text-[11px] font-semibold uppercase tracking-wider transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {filter === 'ALL' ? 'Semua Parameter' : filter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <th className="p-3 w-12 text-center">No.</th>
              <th className="p-3 w-1/4">Sasaran Evaluasi</th>
              <th className="p-3 w-1/3">Hasil Pencapaian (Botol 1 & 2)</th>
              <th className="p-3 w-1/3">Rencana Perbaikan</th>
              <th className="p-3 w-32">Penanggung Jawab</th>
              <th className="p-3 text-center w-20">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredParams.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-500 text-xs">
                  Tidak ada parameter yang sesuai dengan pencarian atau filter.
                </td>
              </tr>
            ) : (
              filteredParams.map((param) => {
                const isEditing = editingId === param.id;

                return (
                  <tr key={param.id} className="hover:bg-slate-50/80 transition-colors align-top">
                    <td className="p-3 text-center font-bold text-slate-400 bg-slate-50/50 font-mono text-xs">
                      {param.no}
                    </td>

                    <td className="p-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 text-sm">{param.parameterName}</span>
                          {getStatusBadge(param.statusOverall)}
                        </div>
                        {param.sourceFileName && (
                          <div className="flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded w-fit">
                            <FileText className="w-3 h-3 text-indigo-500" />
                            <span className="truncate max-w-[180px]">{param.sourceFileName}</span>
                          </div>
                        )}
                        <p className="text-xs text-slate-600 leading-relaxed">{param.sasaran}</p>
                        <div className="pt-1">
                          <button
                            onClick={() => onSelectParameter(param)}
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold uppercase tracking-wider hover:underline"
                          >
                            <Info className="w-3.5 h-3.5" />
                            Detail Z-Score
                          </button>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 space-y-2">
                      {/* Botol 1 Summary */}
                      <div className="p-2.5 rounded border border-slate-200 bg-slate-50/70 text-xs">
                        <div className="flex justify-between font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-1">
                          <span>Botol 1 (Normal)</span>
                          <span className={param.botol1.overallStatus === 'Kurang Memuaskan' ? 'text-red-700 font-bold' : 'text-slate-600'}>
                            Z={param.botol1.seluruh.zScore} [{param.botol1.overallStatus}]
                          </span>
                        </div>
                        <p className="text-slate-700">Hasil: <strong className="text-slate-900">{param.botol1.hasilSaudara} {param.unit}</strong> (Target {param.botol1.seluruh.target})</p>
                      </div>

                      {/* Botol 2 Summary */}
                      <div className="p-2.5 rounded border border-slate-200 bg-slate-50/70 text-xs">
                        <div className="flex justify-between font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-1">
                          <span>Botol 2 (Tinggi)</span>
                          <span className={param.botol2.overallStatus === 'Peringatan' ? 'text-amber-700 font-bold' : 'text-slate-600'}>
                            Z={param.botol2.seluruh.zScore} [{param.botol2.overallStatus}]
                          </span>
                        </div>
                        <p className="text-slate-700">Hasil: <strong className="text-slate-900">{param.botol2.hasilSaudara} {param.unit}</strong> (Target {param.botol2.seluruh.target})</p>
                      </div>
                    </td>

                    <td className="p-3">
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editRencana}
                            onChange={(e) => setEditRencana(e.target.value)}
                            rows={4}
                            className="w-full p-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-slate-400 font-sans"
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={handleCancelEdit}
                              className="px-2.5 py-1 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100 font-medium uppercase tracking-wider"
                            >
                              Batal
                            </button>
                            <button
                              onClick={() => handleSaveEdit(param)}
                              className="px-2.5 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-800 font-semibold uppercase tracking-wider"
                            >
                              Simpan
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs text-slate-700 leading-relaxed">{param.rencanaPerbaikan}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => handleStartEdit(param)}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 uppercase tracking-wider font-semibold transition-colors"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => onGenerateCapa(param)}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-900 hover:text-black font-semibold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 transition-all"
                            >
                              <Sparkles className="w-3 h-3 text-indigo-600" /> AI CAPA
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editPJ}
                          onChange={(e) => setEditPJ(e.target.value)}
                          className="w-full p-1.5 text-xs border border-slate-300 rounded"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-slate-800">{param.penanggungJawab}</span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onSelectParameter(param)}
                          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                          title="Lihat Detail Statistik Z-Score"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        {onDeleteParameter && (
                          <button
                            onClick={() => onDeleteParameter(param.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={`Hapus parameter ${param.parameterName}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

