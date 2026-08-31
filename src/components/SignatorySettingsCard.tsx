import React, { useState, useRef, useEffect } from 'react';
import { PmeDocumentHeader, SignatoryItem } from '../types';
import {
  PenTool,
  Plus,
  Trash2,
  Upload,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Building,
  Calendar,
  Sparkles,
  Layers,
  Save,
  Lock,
  CheckCheck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  getSavedSignatoryConfig,
  saveSignatoryConfig,
  clearSavedSignatoryConfig,
  SavedSignatoryConfig,
} from '../utils/signatoryStorage';

interface SignatorySettingsCardProps {
  header: PmeDocumentHeader;
  onUpdateHeader: (newHeader: PmeDocumentHeader) => void;
  isOpenDefault?: boolean;
}

const PRESET_ROLES = [
  'Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan',
  'Kepala Instalasi Laboratorium',
  'Dokter Spesialis Patologi Klinik (Sp.PK)',
  'Dokter Penanggung Jawab Laboratorium',
  'Penanggung Jawab Mutu Laboratorium',
  'Koordinator Pelayanan Laboratorium',
  'Pengevaluasi PME / Pranata Laboratorium Kesehatan',
  'Kepala Ruangan Laboratorium',
];

export const SignatorySettingsCard: React.FC<SignatorySettingsCardProps> = ({
  header,
  onUpdateHeader,
  isOpenDefault = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(isOpenDefault);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'warn' } | null>(null);
  const [savedConfig, setSavedConfig] = useState<SavedSignatoryConfig | null>(() => getSavedSignatoryConfig());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    setIsExpanded(isOpenDefault);
  }, [isOpenDefault]);

  const showFeedback = (msg: string, type: 'success' | 'info' | 'warn' = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Ensure signatories exist
  const currentSignatories: SignatoryItem[] =
    header.signatories && header.signatories.length > 0
      ? header.signatories
      : [
          {
            id: 'sig-1',
            roleTitle: header.ketuaTimKerja || 'Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan',
            name: header.ketuaTimKerja || 'dr. Lisa Dewi, MKes',
            nipOrId: header.nipKetua || '196907172001122001',
            locationAndDate: `Palembang, ${header.tanggalHasil || '14 November 2025'}`,
            signStyle: 'cursive',
          },
        ];

  const currentLayout = header.signatoryLayout || (currentSignatories.length > 1 ? 'dual' : 'single-right');

  const updateSignatory = (id: string, field: keyof SignatoryItem, value: any) => {
    const updated = currentSignatories.map((sig) => {
      if (sig.id === id) {
        return { ...sig, [field]: value };
      }
      return sig;
    });

    const primary = updated[updated.length - 1] || updated[0];
    onUpdateHeader({
      ...header,
      signatories: updated,
      ketuaTimKerja: primary ? primary.name : header.ketuaTimKerja,
      nipKetua: primary ? primary.nipOrId : header.nipKetua,
    });
    setHasUnsavedChanges(true);
  };

  // Explicit Save Handler
  const handleSaveSettings = () => {
    const primary = currentSignatories[currentSignatories.length - 1] || currentSignatories[0];
    const saved = saveSignatoryConfig({
      signatories: currentSignatories,
      signatoryLayout: currentLayout,
      ketuaTimKerja: primary ? primary.name : header.ketuaTimKerja,
      nipKetua: primary ? primary.nipOrId : header.nipKetua,
      kotaDokumen: header.kotaDokumen,
    });

    if (saved) {
      setSavedConfig(saved);
      setHasUnsavedChanges(false);
      showFeedback(
        'Pengaturan penandatangan BERHASIL DISIMPAN permanen! Tanda tangan telah terkunci dan tidak akan berubah.',
        'success'
      );
    } else {
      showFeedback('Gagal menyimpan ke penyimpanan lokal browser.', 'warn');
    }
  };

  // Reset to default
  const handleResetToDefault = () => {
    clearSavedSignatoryConfig();
    setSavedConfig(null);
    setHasUnsavedChanges(false);
    setShowResetConfirm(false);

    const defaultSigs: SignatoryItem[] = [
      {
        id: 'sig-bblk',
        roleTitle: 'Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan',
        name: 'dr. Lisa Dewi, MKes',
        nipOrId: '196907172001122001',
        locationAndDate: `Palembang, ${header.tanggalHasil || '14 November 2025'}`,
        signStyle: 'cursive',
      },
    ];

    onUpdateHeader({
      ...header,
      signatories: defaultSigs,
      signatoryLayout: 'single-right',
      ketuaTimKerja: 'dr. Lisa Dewi, MKes',
      nipKetua: '196907172001122001',
    });

    showFeedback('Pengaturan penandatangan dikembalikan ke bawaan awal (Default BBLK).', 'info');
  };

  const handleAddSignatory = () => {
    if (currentSignatories.length >= 3) {
      alert('Maksimal 3 kolom penandatangan.');
      return;
    }
    const newId = `sig-${Date.now()}`;
    const newSignatory: SignatoryItem = {
      id: newId,
      roleTitle: 'Kepala Instalasi Laboratorium',
      name: 'dr. Ahmad Fauzi, Sp.PK',
      nipOrId: '197505122003121002',
      locationAndDate: currentSignatories[0]?.locationAndDate || `Palembang, ${header.tanggalHasil}`,
      signStyle: 'cursive',
    };

    const newSignatories = [newSignatory, ...currentSignatories];
    const newLayout = newSignatories.length === 2 ? 'dual' : 'triple';

    onUpdateHeader({
      ...header,
      signatories: newSignatories,
      signatoryLayout: newLayout,
    });
    setHasUnsavedChanges(true);
    showFeedback('Kolom penandatangan baru ditambahkan (Klik "Simpan Pengaturan" agar tersimpan permanen)', 'info');
  };

  const handleRemoveSignatory = (id: string) => {
    if (currentSignatories.length <= 1) {
      alert('Minimal harus ada 1 penandatangan.');
      return;
    }

    const filtered = currentSignatories.filter((s) => s.id !== id);
    const newLayout = filtered.length === 1 ? 'single-right' : 'dual';

    onUpdateHeader({
      ...header,
      signatories: filtered,
      signatoryLayout: newLayout,
      ketuaTimKerja: filtered[filtered.length - 1]?.name || header.ketuaTimKerja,
      nipKetua: filtered[filtered.length - 1]?.nipOrId || header.nipKetua,
    });
    setHasUnsavedChanges(true);
    showFeedback('Kolom penandatangan dihapus (Klik "Simpan Pengaturan" untuk menetapkan)', 'info');
  };

  const handleImageUpload = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      updateSignatory(id, 'customSignatureImage', result);
      updateSignatory(id, 'signStyle', 'image');
      showFeedback('Gambar tanda tangan / stempel diunggah. Klik "Simpan Pengaturan" untuk menyimpan permanen.', 'success');
    };
    reader.readAsDataURL(file);
  };

  // Quick Presets
  const applyPreset = (presetType: 'bblk' | 'rs-dual' | 'sppk-atlm' | 'triple') => {
    const locDate = `${header.kotaDokumen || 'Palembang'}, ${header.tanggalHasil || '14 November 2025'}`;

    if (presetType === 'bblk') {
      const sigs: SignatoryItem[] = [
        {
          id: 'sig-bblk',
          roleTitle: 'Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan',
          name: 'dr. Lisa Dewi, MKes',
          nipOrId: '196907172001122001',
          locationAndDate: locDate,
          signStyle: 'cursive',
        },
      ];
      onUpdateHeader({
        ...header,
        signatories: sigs,
        signatoryLayout: 'single-right',
        ketuaTimKerja: 'dr. Lisa Dewi, MKes',
        nipKetua: '196907172001122001',
      });
    } else if (presetType === 'rs-dual') {
      const sigs: SignatoryItem[] = [
        {
          id: 'sig-rs-1',
          roleTitle: 'Mengetahui,\nKepala Instalasi Laboratorium',
          name: 'dr. Hendra Wijaya, Sp.PK',
          nipOrId: '197608152002121003',
          locationAndDate: '',
          signStyle: 'cursive',
        },
        {
          id: 'sig-rs-2',
          roleTitle: 'Penanggung Jawab Mutu Laboratorium',
          name: 'Rina Marlina, S.Tr.Kes',
          nipOrId: '198804222010122004',
          locationAndDate: locDate,
          signStyle: 'cursive',
        },
      ];
      onUpdateHeader({
        ...header,
        signatories: sigs,
        signatoryLayout: 'dual',
        ketuaTimKerja: 'Rina Marlina, S.Tr.Kes',
        nipKetua: '198804222010122004',
      });
    } else if (presetType === 'sppk-atlm') {
      const sigs: SignatoryItem[] = [
        {
          id: 'sig-sppk-1',
          roleTitle: 'Dokter Penanggung Jawab Pelayanan (Sp.PK)',
          name: 'dr. Lisa Dewi, MKes, Sp.PK',
          nipOrId: '196907172001122001',
          locationAndDate: '',
          signStyle: 'cursive',
        },
        {
          id: 'sig-sppk-2',
          roleTitle: 'Pengevaluasi PME / Pranata Labkes',
          name: 'Budi Santoso, A.Md.AK',
          nipOrId: '199203142015031002',
          locationAndDate: locDate,
          signStyle: 'cursive',
        },
      ];
      onUpdateHeader({
        ...header,
        signatories: sigs,
        signatoryLayout: 'dual',
        ketuaTimKerja: 'Budi Santoso, A.Md.AK',
        nipKetua: '199203142015031002',
      });
    } else if (presetType === 'triple') {
      const sigs: SignatoryItem[] = [
        {
          id: 'sig-tri-1',
          roleTitle: 'Mengetahui,\nKepala Instalasi Laboratorium',
          name: 'dr. Hendra Wijaya, Sp.PK',
          nipOrId: '197608152002121003',
          locationAndDate: '',
          signStyle: 'cursive',
        },
        {
          id: 'sig-tri-2',
          roleTitle: 'Penanggung Jawab Teknis Mutu',
          name: 'dr. Lisa Dewi, MKes',
          nipOrId: '196907172001122001',
          locationAndDate: '',
          signStyle: 'cursive',
        },
        {
          id: 'sig-tri-3',
          roleTitle: 'Petugas Evaluator PME / ATLM',
          name: 'Siti Rahmawati, S.Si',
          nipOrId: '199011052014022003',
          locationAndDate: locDate,
          signStyle: 'cursive',
        },
      ];
      onUpdateHeader({
        ...header,
        signatories: sigs,
        signatoryLayout: 'triple',
        ketuaTimKerja: 'Siti Rahmawati, S.Si',
        nipKetua: '199011052014022003',
      });
    }
    setHasUnsavedChanges(true);
    showFeedback('Preset diterapkan. Klik "Simpan Pengaturan" agar tersimpan permanen.', 'info');
  };

  const formattedSavedDate = savedConfig?.savedAt
    ? new Date(savedConfig.savedAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden print:hidden transition-all">
      {/* Header Banner */}
      <div
        className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/70 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-md shadow-2xs">
            <PenTool className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Pengaturan Penandatangan Dokumen
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 rounded-full">
                {currentSignatories.length} Penandatangan ({currentLayout})
              </span>
              {savedConfig ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-full">
                  <Lock className="w-3 h-3 text-emerald-600" /> Tersimpan Permanen
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-slate-600 bg-slate-100 rounded-full">
                  Bawaan Default
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Sesuaikan nama penandatangan, gelar, NIP/SIP, jabatan, kota & tanggal. Simpan agar tidak kembali ke tanda tangan lama.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
          {/* Quick Save button in header */}
          <button
            type="button"
            onClick={handleSaveSettings}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md shadow-sm transition-all cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400 ring-offset-1 animate-pulse'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white'
            }`}
            title="Klik untuk menyimpan perubahan penandatangan secara permanen"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Floating/Inline Toast Feedback */}
      {toastMessage && (
        <div
          className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : toastMessage.type === 'warn'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {isExpanded && (
        <div className="p-5 sm:p-6 space-y-6">
          {/* Permanent Save Action & Status Banner */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border-2 border-emerald-300/80 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-600 text-white rounded-md shadow-2xs">
                  <CheckCheck className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-emerald-950 uppercase tracking-wide">
                  Penyimpanan Permanen Tanda Tangan
                </h4>
                {hasUnsavedChanges && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-200 text-amber-900 rounded-full border border-amber-300">
                    Ada perubahan belum disimpan
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-900/80 leading-relaxed">
                {savedConfig
                  ? `Pengaturan tanda tangan Anda tersimpan permanen di browser ini (Terakhir disimpan: ${formattedSavedDate}). Tanda tangan tidak akan berubah ke versi lama meskipun upload file baru.`
                  : 'Klik tombol hijau di sebelah kanan untuk mengunci dan menyimpan tanda tangan Anda agar tidak berubah saat ganti file atau refresh.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Simpan Pengaturan Tandatangan
              </button>

              {savedConfig && (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="px-3 py-2.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-red-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  title="Kembalikan ke tanda tangan bawaan default"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Reset Confirmation Dialog */}
          {showResetConfirm && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-950 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Yakin ingin menghapus tanda tangan tersimpan dan kembali ke tanda tangan bawaan sistem (BBLK)?
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="px-3 py-1 bg-red-600 text-white font-bold rounded hover:bg-red-700 cursor-pointer"
                >
                  Ya, Reset
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Preset Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Preset Cepat:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => applyPreset('bblk')}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-medium shadow-2xs transition-colors cursor-pointer"
              >
                1 TTD (BBLK/Penyelenggara)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('rs-dual')}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-medium shadow-2xs transition-colors cursor-pointer"
              >
                2 TTD (Kepala Lab & PJ Mutu)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('sppk-atlm')}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-medium shadow-2xs transition-colors cursor-pointer"
              >
                2 TTD (Dokter Sp.PK & ATLM)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('triple')}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-medium shadow-2xs transition-colors cursor-pointer"
              >
                3 TTD (Lengkap)
              </button>
            </div>
          </div>

          {/* Layout Configuration */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500" /> Tata Letak Kolom:
              </label>
              <select
                value={currentLayout}
                onChange={(e) => {
                  onUpdateHeader({
                    ...header,
                    signatoryLayout: e.target.value as any,
                  });
                  setHasUnsavedChanges(true);
                }}
                className="text-xs border border-slate-300 rounded px-2.5 py-1 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="single-right">1 Kolom (Kanan)</option>
                <option value="single-left">1 Kolom (Kiri)</option>
                <option value="dual">2 Kolom (Kiri & Kanan)</option>
                <option value="triple">3 Kolom (Kiri, Tengah, Kanan)</option>
              </select>
            </div>

            {currentSignatories.length < 3 && (
              <button
                type="button"
                onClick={handleAddSignatory}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Penandatangan ({currentSignatories.length}/3)
              </button>
            )}
          </div>

          {/* Dynamic Signatory Cards Grid */}
          <div
            className={`grid grid-cols-1 ${
              currentSignatories.length === 2 ? 'md:grid-cols-2' : currentSignatories.length === 3 ? 'md:grid-cols-3' : 'max-w-xl mx-auto'
            } gap-5`}
          >
            {currentSignatories.map((sig, index) => {
              const columnLabel =
                currentSignatories.length === 1
                  ? 'Penandatangan Utama'
                  : currentSignatories.length === 2
                  ? index === 0
                    ? 'Penandatangan 1 (Kiri / Mengetahui)'
                    : 'Penandatangan 2 (Kanan / Pelaksana)'
                  : index === 0
                  ? 'Penandatangan 1 (Kiri)'
                  : index === 1
                  ? 'Penandatangan 2 (Tengah)'
                  : 'Penandatangan 3 (Kanan)';

              return (
                <div
                  key={sig.id}
                  className="bg-slate-50/90 rounded-lg border border-slate-200 p-4 space-y-3.5 relative flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                      {columnLabel}
                    </span>
                    {currentSignatories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSignatory(sig.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors cursor-pointer"
                        title="Hapus kolom penandatangan ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* Lokasi & Tanggal */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" /> Kota & Tanggal TTD
                      </label>
                      <input
                        type="text"
                        value={sig.locationAndDate || ''}
                        placeholder="Contoh: Palembang, 14 November 2025 (Kosongkan jika di posisi kiri)"
                        onChange={(e) => updateSignatory(sig.id, 'locationAndDate', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Jabatan / Posisi */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                          <Building className="w-3 h-3 text-slate-400" /> Jabatan / Posisi
                        </label>
                        <select
                          className="text-[10px] text-slate-500 bg-transparent border-0 underline cursor-pointer hover:text-indigo-600"
                          onChange={(e) => {
                            if (e.target.value) {
                              updateSignatory(sig.id, 'roleTitle', e.target.value);
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Pilih Template Jabatan...
                          </option>
                          {PRESET_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="text"
                        value={sig.roleTitle}
                        placeholder="Contoh: Ketua Tim Kerja Mutu..."
                        onChange={(e) => updateSignatory(sig.id, 'roleTitle', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Nama Lengkap & Gelar */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Nama Lengkap & Gelar
                      </label>
                      <input
                        type="text"
                        value={sig.name}
                        placeholder="Contoh: dr. Lisa Dewi, MKes"
                        onChange={(e) => updateSignatory(sig.id, 'name', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 font-bold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                      />
                    </div>

                    {/* NIP / No. Identitas */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        NIP / SIP / ID Kepegawaian
                      </label>
                      <input
                        type="text"
                        value={sig.nipOrId}
                        placeholder="Contoh: 196907172001122001"
                        onChange={(e) => updateSignatory(sig.id, 'nipOrId', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Gaya Tanda Tangan */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Model Tanda Tangan
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateSignatory(sig.id, 'signStyle', 'cursive')}
                          className={`px-2 py-1 text-[11px] font-medium rounded border text-center transition-colors cursor-pointer ${
                            sig.signStyle === 'cursive' || !sig.signStyle
                              ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          Kaligrafi
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSignatory(sig.id, 'signStyle', 'plain')}
                          className={`px-2 py-1 text-[11px] font-medium rounded border text-center transition-colors cursor-pointer ${
                            sig.signStyle === 'plain'
                              ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          TTD Basah (Kosong)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRefs.current[sig.id]?.click();
                          }}
                          className={`px-2 py-1 text-[11px] font-medium rounded border text-center transition-colors cursor-pointer inline-flex items-center justify-center gap-1 ${
                            sig.signStyle === 'image'
                              ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <Upload className="w-3 h-3" /> Upload TTD
                        </button>
                      </div>

                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        ref={(el) => (fileInputRefs.current[sig.id] = el)}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleImageUpload(sig.id, file);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Visual Preview Box */}
                  <div className="mt-3 p-3 bg-white rounded border border-slate-200 text-center select-none shadow-2xs">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Pratinjau Hasil Cetak</p>
                    {sig.locationAndDate && (
                      <p className="text-[11px] text-slate-600 mt-1">{sig.locationAndDate}</p>
                    )}
                    <p className="font-semibold text-[11px] text-slate-700 mt-0.5 leading-snug">
                      {sig.roleTitle}
                    </p>

                    <div className="h-14 my-1.5 flex items-center justify-center">
                      {sig.signStyle === 'image' && sig.customSignatureImage ? (
                        <img
                          src={sig.customSignatureImage}
                          alt="Tanda Tangan"
                          className="max-h-12 max-w-[140px] object-contain"
                        />
                      ) : sig.signStyle === 'plain' ? (
                        <div className="h-10 border-b border-dashed border-slate-300 w-32" />
                      ) : (
                        <span className="font-serif italic text-slate-800 text-lg font-bold opacity-85">
                          ~ {sig.name} ~
                        </span>
                      )}
                    </div>

                    <p className="font-bold underline text-xs text-slate-900">{sig.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {sig.nipOrId.startsWith('NIP') || sig.nipOrId.startsWith('SIP') ? sig.nipOrId : `NIP ${sig.nipOrId}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Action Save Bar */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-4 rounded-lg">
            <div className="text-xs text-slate-600 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span>
                Simpan pengaturan ini agar tidak terganti saat membuka file dokumen lain.
              </span>
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Simpan Pengaturan Tandatangan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
