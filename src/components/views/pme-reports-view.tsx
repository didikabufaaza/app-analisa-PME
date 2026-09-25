"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Printer,
  Download,
  FileBarChart,
  Layers,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  Calendar,
  Sparkles,
  Loader2,
  RefreshCw,
  Search,
  Activity,
  ShieldCheck,
  Award,
  PenLine,
  Send,
  Save,
  Clock,
  FileCheck2,
  TableProperties,
  Info,
  RotateCcw,
  Upload,
  Image as ImageIcon,
  Trash2,
  FileSpreadsheet,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface EvaluationRow {
  no: number;
  parameterName: string;
  unit: string;
  methodCode: string;
  instrumentCode: string;
  reagentName?: string;
  participantValue: number | null;
  global: {
    n: number;
    target: number | null;
    sdpa: number | null;
    zScore: number | null;
    category: string;
    keterangan: string;
  };
  method: {
    n: number;
    target: number | null;
    sdpa: number | null;
    zScore: number | null;
    category: string;
    keterangan: string;
    isAnalyzed: boolean;
  };
  instrument: {
    n: number;
    target: number | null;
    sdpa: number | null;
    zScore: number | null;
    category: string;
    keterangan: string;
    isAnalyzed: boolean;
  };
  biasPercent: number | null;
  biasMethodPercent: number | null;
  biasInstrumentPercent: number | null;
  cvPercent: number | null;
  totalErrorPercent: number | null;
  outlierStatus: string;
  dixonStatus: string;
}

interface SignerData {
  namaPejabat: string;
  jabatan: string;
  tempat: string;
  tanggal: string;
  nip: string;
}

interface ParticipantReport {
  submissionId: string;
  participant: {
    id: string;
    participantCode: string | null;
    labName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  cycle: string;
  period: string | null;
  submittedAt: string;
  status: string;
  isValidated: boolean;
  validatedAt: string | null;
  validatedBy: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
  category: string;
  rows: EvaluationRow[];
  comments: string[];
}

interface DashboardStatItem {
  parameterName: string;
  unit: string | null;
  stats: {
    n: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    q1: number;
    q3: number;
    iqr: number;
    sdpa: number;
    mad: number;
    robustSd: number;
    cvPercent: number;
    innerLower: number;
    innerUpper: number;
    outerLower: number;
    outerUpper: number;
  } | null;
  dixon: {
    isApplicable: boolean;
    n: number;
    qTable: number | null;
    qMin: number | null;
    qMax: number | null;
    isLowOutlier: boolean;
    isHighOutlier: boolean;
    status: string;
  } | null;
}

export function PmeReportsView() {
  const { user, viewAsTenantId, navigate } = useAppStore();
  const { toast } = useToast();

  const printAreaRef = useRef<HTMLDivElement>(null);

  const [cycle, setCycle] = useState<string>("");
  const [availableCycles, setAvailableCycles] = useState<string[]>([]);
  const [customCycleMode, setCustomCycleMode] = useState(false);
  const [customCycleInput, setCustomCycleInput] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("ALL");
  const [parameterFilter, setParameterFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStatItem[]>([]);
  const [participantReports, setParticipantReports] = useState<ParticipantReport[]>([]);
  const [kopSurat, setKopSurat] = useState<any>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);
  const [participantNotice, setParticipantNotice] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [activeTab, setActiveTab] = useState<string>("report");

  // State Filter & Status Rekapitulasi Laporan Hasil PME
  const [recapPeriod, setRecapPeriod] = useState<string>("ALL");
  const [recapCategory, setRecapCategory] = useState<string>("ALL");
  const [recapParticipant, setRecapParticipant] = useState<string>("ALL");
  const [recapParameter, setRecapParameter] = useState<string>("ALL");
  const [recapStatus, setRecapStatus] = useState<string>("ALL");
  const [recapSearch, setRecapSearch] = useState<string>("");
  const [isExportingRecapPdf, setIsExportingRecapPdf] = useState(false);
  const [isExportingRecapExcel, setIsExportingRecapExcel] = useState(false);

  // Data Penandatangan Laporan
  const [signer, setSigner] = useState<SignerData>({
    namaPejabat: "M.Didik Wahyudi, S.Tr.Kes",
    jabatan: "Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan",
    tempat: "OKU Timur",
    tanggal: "14 November 2027",
    nip: "198408152009041001",
  });
  const [isSignerModalOpen, setIsSignerModalOpen] = useState(false);
  const [signerForm, setSignerForm] = useState<SignerData>({ ...signer });
  const [savingSigner, setSavingSigner] = useState(false);

  // Data & Pengaturan KOP Surat Laporan
  const [isKopSuratModalOpen, setIsKopSuratModalOpen] = useState(false);
  const [kopSuratForm, setKopSuratForm] = useState({
    pemda: "Kementerian Kesehatan Republik Indonesia",
    namaRumahSakit: "Balai Besar Laboratorium Kesehatan Masyarakat (Labkesmas Palembang I)",
    alamatRumahSakit: "Jl. Inspektur Yazid No.2, Sekip Jaya, Palembang, Sumatera Selatan",
    kontakRumahSakit: "Telp: (0711) 352 683 | Email: bblabkesmaspalembang@kemkes.go.id",
    logoKiri: null as string | null,
    logoKanan: null as string | null,
  });
  const [savingKopSurat, setSavingKopSurat] = useState(false);
  const [uploadingLogoKiri, setUploadingLogoKiri] = useState(false);
  const [uploadingLogoKanan, setUploadingLogoKanan] = useState(false);

  // Aksi Validasi & Publikasi
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // Aksi Penarikan / Pembatalan Laporan (Superadmin)
  const [isRetractModalOpen, setIsRetractModalOpen] = useState(false);
  const [retracting, setRetracting] = useState(false);

  const loadReports = async (overrideCycle?: string) => {
    setLoading(true);
    try {
      const activeCycle = overrideCycle !== undefined ? overrideCycle : cycle;
      const url = `/api/pme-mgmt/reports?cycle=${encodeURIComponent(activeCycle || "")}&category=${encodeURIComponent(category)}${
        selectedParticipantId !== "ALL" ? `&participantId=${selectedParticipantId}` : ""
      }`;

      const res = await fetch(url, { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        if (data.availableCycles && Array.isArray(data.availableCycles)) {
          setAvailableCycles(data.availableCycles);
        }
        if (data.cycle) {
          setCycle(data.cycle);
        }
        if (data.signer) {
          setSigner(data.signer);
          setSignerForm(data.signer);
        }
        setIsSuperAdmin(data.isSuperAdmin ?? true);
        setIsParticipant(data.isParticipant ?? false);
        setParticipantNotice(data.message || null);
        setSummary(data.summary);
        setDashboardStats(data.dashboardStats || []);
        setParticipantReports(data.participantReports || []);
        setKopSurat(data.kopSurat || null);
        if (data.kopSurat) {
          setKopSuratForm({
            pemda: data.kopSurat.pemda || "Kementerian Kesehatan Republik Indonesia",
            namaRumahSakit: data.kopSurat.namaRumahSakit || "Balai Besar Laboratorium Kesehatan Masyarakat (Labkesmas Palembang I)",
            alamatRumahSakit: data.kopSurat.alamatRumahSakit || "Jl. Inspektur Yazid No.2, Sekip Jaya, Palembang, Sumatera Selatan",
            kontakRumahSakit: data.kopSurat.kontakRumahSakit || "Telp: (0711) 352 683 | Email: bblabkesmaspalembang@kemkes.go.id",
            logoKiri: data.kopSurat.logoKiri || null,
            logoKanan: data.kopSurat.logoKanan || null,
          });
        }
      } else {
        const err = await res.json();
        toast({ title: "Gagal memuat laporan", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Gagal mengambil data laporan.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports(cycle);
  }, [category, selectedParticipantId, viewAsTenantId]);

  const handleCycleSelect = (newCycle: string) => {
    setCycle(newCycle);
    loadReports(newCycle);
  };

  const handleApplyCustomCycle = () => {
    if (customCycleInput.trim()) {
      const newCycle = customCycleInput.trim();
      setCycle(newCycle);
      loadReports(newCycle);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Simpan Data Penandatangan
  const handleSaveSigner = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSigner(true);
    try {
      const res = await fetch("/api/pme-mgmt/signer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(signerForm),
      });
      if (res.ok) {
        const data = await res.json();
        setSigner(data.signer);
        setIsSignerModalOpen(false);
        toast({
          title: "Penandatangan Berhasil Disimpan",
          description: "Data penandatangan resmi diperbarui pada lembar laporan dan PDF.",
        });
      } else {
        const err = await res.json();
        toast({ title: "Gagal menyimpan", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", variant: "destructive" });
    } finally {
      setSavingSigner(false);
    }
  };

  // Aksi Validasi & Nyatakan Selesai
  const handleValidateReport = async () => {
    setValidating(true);
    try {
      const res = await fetch("/api/pme-mgmt/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "validate",
          cycle,
          participantId: selectedParticipantId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Laporan Berhasil Divalidasi!",
          description: data.message || "Laporan hasil evaluasi telah dinyatakan valid dan selesai dikoreksi.",
        });
        await loadReports(cycle);
      } else {
        const err = await res.json();
        toast({ title: "Gagal validasi", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  // Aksi Kirim Laporan ke Peserta PME
  const handlePublishReport = async () => {
    setPublishing(true);
    try {
      const res = await fetch("/api/pme-mgmt/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "publish",
          cycle,
          participantId: selectedParticipantId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsPublishModalOpen(false);
        toast({
          title: "Laporan Terkirim ke Peserta!",
          description: data.message || "Laporan hasil PME telah berhasil dikirimkan ke akun peserta.",
        });
        await loadReports(cycle);
      } else {
        const err = await res.json();
        toast({ title: "Gagal mengirim laporan", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  // Upload Logo KOP Surat ke Google Drive
  const handleLogoUpload = async (file: File, type: "kiri" | "kanan") => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Format Berkas Tidak Valid",
        description: "Silakan pilih berkas gambar (PNG, JPG, JPEG, WebP, SVG).",
        variant: "destructive",
      });
      return;
    }

    if (type === "kiri") setUploadingLogoKiri(true);
    else setUploadingLogoKanan(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const res = await fetch("/api/kop-surat/upload", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setKopSuratForm((prev) => ({
          ...prev,
          [type === "kiri" ? "logoKiri" : "logoKanan"]: data.logoUrl,
        }));
        toast({
          title: `Logo ${type === "kiri" ? "Kiri" : "Kanan"} Berhasil Diunggah!`,
          description: "Gambar telah tersimpan di Google Drive folder PME.",
        });
      } else {
        const err = await res.json();
        toast({
          title: "Gagal Mengunggah Logo",
          description: err.error || "Terjadi kesalahan saat mengunggah ke Google Drive.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Kesalahan Jaringan",
        description: "Gagal mengunggah logo ke Google Drive.",
        variant: "destructive",
      });
    } finally {
      if (type === "kiri") setUploadingLogoKiri(false);
      else setUploadingLogoKanan(false);
    }
  };

  // Simpan Pengaturan KOP Surat
  const handleSaveKopSurat = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKopSurat(true);
    try {
      const res = await fetch("/api/kop-surat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(kopSuratForm),
      });

      if (res.ok) {
        const data = await res.json();
        setKopSurat(data.kopSurat || kopSuratForm);
        setIsKopSuratModalOpen(false);
        toast({
          title: "KOP Surat Berhasil Disimpan!",
          description: "Format identitas & logo resmi instansi telah diperbarui pada seluruh laporan.",
        });
        await loadReports(cycle);
      } else {
        const err = await res.json();
        toast({
          title: "Gagal Menyimpan KOP Surat",
          description: err.error || "Terjadi kesalahan sistem.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Kesalahan Jaringan",
        description: "Gagal menyimpan data KOP Surat.",
        variant: "destructive",
      });
    } finally {
      setSavingKopSurat(false);
    }
  };

  // Aksi Tarik / Batalkan Laporan (Superadmin)
  const handleRetractReport = async () => {
    setRetracting(true);
    try {
      const res = await fetch("/api/pme-mgmt/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "retract",
          cycle,
          participantId: selectedParticipantId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsRetractModalOpen(false);
        toast({
          title: "Laporan Berhasil Ditarik!",
          description: data.message || "Tampilan laporan hasil pada akun peserta kini telah kembali kosong.",
        });
        await loadReports(cycle);
      } else {
        const err = await res.json();
        toast({
          title: "Gagal Menarik Laporan",
          description: err.error || "Terjadi kesalahan sistem.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Kesalahan Jaringan",
        description: "Gagal menarik laporan hasil PME.",
        variant: "destructive",
      });
    } finally {
      setRetracting(false);
    }
  };

  // Daftar Semua Parameter Unik untuk Filter Parameter
  const availableParameters = useMemo(() => {
    const set = new Set<string>();
    participantReports.forEach((pr) => {
      pr.rows.forEach((r) => set.add(r.parameterName));
    });
    return Array.from(set).sort();
  }, [participantReports]);

  // Flatten data untuk Tab Rekapitulasi Laporan Hasil PME
  const flattenedRecapData = useMemo(() => {
    const list: Array<{
      no: number;
      submissionId: string;
      participantId: string;
      participantCode: string;
      labName: string;
      cycle: string;
      period: string;
      category: string;
      parameterName: string;
      unit: string;
      participantValue: number | null;
      target: number | null;
      sdpa: number | null;
      zScore: number | null;
      keterangan: string;
      categoryStatus: string;
      methodCode: string;
      instrumentCode: string;
      reagentName: string;
      biasPercent: number | null;
      cvPercent: number | null;
      totalErrorPercent: number | null;
    }> = [];

    let count = 1;
    participantReports.forEach((pr) => {
      pr.rows.forEach((r) => {
        list.push({
          no: count++,
          submissionId: pr.submissionId,
          participantId: pr.participant.id,
          participantCode: pr.participant.participantCode || "-",
          labName: pr.participant.labName,
          cycle: pr.cycle,
          period: pr.period || "-",
          category: pr.category,
          parameterName: r.parameterName,
          unit: r.unit || "-",
          participantValue: r.participantValue,
          target: r.global.target,
          sdpa: r.global.sdpa,
          zScore: r.global.zScore,
          keterangan: r.global.keterangan,
          categoryStatus: r.global.category,
          methodCode: r.methodCode || "-",
          instrumentCode: r.instrumentCode || "-",
          reagentName: r.reagentName || "-",
          biasPercent: r.biasPercent,
          cvPercent: r.cvPercent,
          totalErrorPercent: r.totalErrorPercent,
        });
      });
    });
    return list;
  }, [participantReports]);

  // Filter Data Rekapitulasi
  const filteredRecapData = useMemo(() => {
    return flattenedRecapData.filter((item) => {
      if (recapPeriod !== "ALL" && item.period !== recapPeriod) return false;
      if (recapCategory !== "ALL" && item.category !== recapCategory) return false;
      if (recapParticipant !== "ALL" && item.participantId !== recapParticipant) return false;
      if (recapParameter !== "ALL" && item.parameterName.toLowerCase() !== recapParameter.toLowerCase()) return false;
      if (recapStatus !== "ALL") {
        if (recapStatus === "SATISFACTORY" && item.keterangan !== "Memuaskan") return false;
        if (recapStatus === "WARNING" && item.keterangan !== "Peringatan") return false;
        if (recapStatus === "UNSATISFACTORY" && item.keterangan !== "Tidak Memuaskan") return false;
        if (recapStatus === "NOT_EXAMINED" && item.participantValue !== null) return false;
      }
      if (recapSearch.trim()) {
        const q = recapSearch.toLowerCase().trim();
        const match =
          item.labName.toLowerCase().includes(q) ||
          item.participantCode.toLowerCase().includes(q) ||
          item.parameterName.toLowerCase().includes(q) ||
          item.methodCode.toLowerCase().includes(q) ||
          item.instrumentCode.toLowerCase().includes(q) ||
          item.reagentName.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [flattenedRecapData, recapPeriod, recapCategory, recapParticipant, recapParameter, recapStatus, recapSearch]);

  // Pilihan Periode Unik untuk Filter Rekap
  const recapAvailablePeriods = useMemo(() => {
    const set = new Set<string>();
    flattenedRecapData.forEach((d) => {
      if (d.period && d.period !== "-") set.add(d.period);
    });
    return Array.from(set).sort();
  }, [flattenedRecapData]);

  // Pilihan Kategori Unik untuk Filter Rekap
  const recapAvailableCategories = useMemo(() => {
    const set = new Set<string>();
    flattenedRecapData.forEach((d) => {
      if (d.category) set.add(d.category);
    });
    return Array.from(set).sort();
  }, [flattenedRecapData]);

  // Pilihan Peserta Unik untuk Filter Rekap
  const recapAvailableParticipants = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    flattenedRecapData.forEach((d) => {
      if (!map.has(d.participantId)) {
        map.set(d.participantId, {
          id: d.participantId,
          code: d.participantCode,
          name: d.labName,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [flattenedRecapData]);

  // Pilihan Parameter Unik untuk Filter Rekap
  const recapAvailableParameters = useMemo(() => {
    const set = new Set<string>();
    flattenedRecapData.forEach((d) => {
      if (d.parameterName) set.add(d.parameterName);
    });
    return Array.from(set).sort();
  }, [flattenedRecapData]);

  // Metrik Statistik Rekapitulasi
  const recapStats = useMemo(() => {
    const totalTests = filteredRecapData.length;
    const uniqueLabs = new Set(filteredRecapData.map((d) => d.participantId)).size;
    const satisfactory = filteredRecapData.filter((d) => d.keterangan === "Memuaskan").length;
    const warning = filteredRecapData.filter((d) => d.keterangan === "Peringatan").length;
    const unsatisfactory = filteredRecapData.filter((d) => d.keterangan === "Tidak Memuaskan").length;
    const notExamined = filteredRecapData.filter((d) => d.participantValue === null).length;
    const evaluatedTests = totalTests - notExamined;
    const passRate = evaluatedTests > 0 ? ((satisfactory / evaluatedTests) * 100).toFixed(1) : "0.0";

    return {
      totalTests,
      uniqueLabs,
      satisfactory,
      warning,
      unsatisfactory,
      notExamined,
      evaluatedTests,
      passRate,
    };
  }, [filteredRecapData]);

  const handleResetRecapFilters = () => {
    setRecapPeriod("ALL");
    setRecapCategory("ALL");
    setRecapParticipant("ALL");
    setRecapParameter("ALL");
    setRecapStatus("ALL");
    setRecapSearch("");
  };

  // Ekspor Excel Rekap Lengkap (2 Sheets dengan ExcelJS)
  const handleExportRecapExcel = async () => {
    try {
      setIsExportingRecapExcel(true);
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "SmartPME System";
      wb.lastModifiedBy = signer.namaPejabat || "Superadmin SmartPME";
      wb.created = new Date();

      // ===== SHEET 1: REKAP HASIL PME =====
      const ws1 = wb.addWorksheet("Rekap Hasil PME", {
        views: [{ showGridLines: true }],
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
      });

      // Title & Header Information
      ws1.mergeCells("A1:P1");
      const titleCell = ws1.getCell("A1");
      titleCell.value = (kopSurat?.pemda || "KEMENTERIAN KESEHATAN REPUBLIK INDONESIA").toUpperCase();
      titleCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF334155" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };

      ws1.mergeCells("A2:P2");
      const instansiCell = ws1.getCell("A2");
      instansiCell.value = (kopSurat?.namaRumahSakit || "BALAI BESAR LABORATORIUM KESEHATAN MASYARAKAT PALEMBANG").toUpperCase();
      instansiCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF0F172A" } };
      instansiCell.alignment = { horizontal: "center", vertical: "middle" };

      ws1.mergeCells("A3:P3");
      const subTitleCell = ws1.getCell("A3");
      subTitleCell.value = `REKAPITULASI LAPORAN HASIL PROGRAM EVALUASI MUTU EKSTERNAL (PME) - SIKLUS: ${cycle.toUpperCase()}`;
      subTitleCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF047857" } };
      subTitleCell.alignment = { horizontal: "center", vertical: "middle" };

      ws1.mergeCells("A4:P4");
      const metaCell = ws1.getCell("A4");
      metaCell.value = `Tanggal Ekspor: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} | Total Hasil Uji: ${recapStats.totalTests} | Total Lab: ${recapStats.uniqueLabs} | Pass Rate: ${recapStats.passRate}%`;
      metaCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
      metaCell.alignment = { horizontal: "center", vertical: "middle" };

      ws1.addRow([]);

      const headers = [
        "No",
        "Kode Lab",
        "Nama Laboratorium",
        "Siklus",
        "Periode",
        "Kategori",
        "Parameter",
        "Satuan",
        "Hasil Lab",
        "Target (Median)",
        "SDPA",
        "Z-Score",
        "Status Kinerja",
        "Metode",
        "Alat",
        "Nama Reagen",
      ];
      const headerRow = ws1.addRow(headers);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0F766E" },
        };
        cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "medium", color: { argb: "FF0F172A" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });

      filteredRecapData.forEach((item, idx) => {
        const row = ws1.addRow([
          idx + 1,
          item.participantCode,
          item.labName,
          item.cycle,
          item.period,
          item.category,
          item.parameterName,
          item.unit,
          item.participantValue !== null ? item.participantValue : "-",
          item.target !== null ? item.target : "-",
          item.sdpa !== null ? item.sdpa : "-",
          item.zScore !== null ? `${item.zScore > 0 ? "+" : ""}${item.zScore.toFixed(2)}` : "-",
          item.keterangan,
          item.methodCode,
          item.instrumentCode,
          item.reagentName,
        ]);
        row.height = 20;

        row.eachCell((cell, colNumber) => {
          cell.font = { name: "Arial", size: 9 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          if ([1, 2, 4, 5, 8, 12, 14, 15].includes(colNumber)) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else if ([9, 10, 11].includes(colNumber)) {
            cell.alignment = { horizontal: "right", vertical: "middle" };
          } else if (colNumber === 13) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }

          if (idx % 2 === 1 && colNumber !== 13) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" },
            };
          }
        });

        const statusCell = row.getCell(13);
        if (item.keterangan === "Memuaskan") {
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
          statusCell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF166534" } };
        } else if (item.keterangan === "Peringatan") {
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
          statusCell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF92400E" } };
        } else if (item.keterangan === "Tidak Memuaskan") {
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
          statusCell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF991B1B" } };
        }
      });

      ws1.columns = [
        { width: 6 },
        { width: 14 },
        { width: 30 },
        { width: 14 },
        { width: 10 },
        { width: 16 },
        { width: 22 },
        { width: 12 },
        { width: 12 },
        { width: 14 },
        { width: 12 },
        { width: 12 },
        { width: 18 },
        { width: 16 },
        { width: 16 },
        { width: 22 },
      ];

      const lastRowIndex = ws1.rowCount + 2;
      const sigCol = 13;
      ws1.getCell(lastRowIndex, sigCol).value = `${signer.tempat || "Palembang"}, ${signer.tanggal || new Date().toLocaleDateString("id-ID")}`;
      ws1.getCell(lastRowIndex, sigCol).font = { name: "Arial", size: 9 };
      ws1.getCell(lastRowIndex + 1, sigCol).value = signer.jabatan || "Penanggung Jawab Mutu";
      ws1.getCell(lastRowIndex + 1, sigCol).font = { name: "Arial", size: 9 };
      ws1.getCell(lastRowIndex + 4, sigCol).value = signer.namaPejabat || "Penyelenggara PME";
      ws1.getCell(lastRowIndex + 4, sigCol).font = { name: "Arial", size: 9.5, bold: true, underline: true };
      ws1.getCell(lastRowIndex + 5, sigCol).value = `NIP. ${signer.nip || "-"}`;
      ws1.getCell(lastRowIndex + 5, sigCol).font = { name: "Arial", size: 8.5 };

      // ===== SHEET 2: RINGKASAN PER LABORATORIUM =====
      const ws2 = wb.addWorksheet("Ringkasan Per Lab", {
        views: [{ showGridLines: true }],
      });

      ws2.mergeCells("A1:H1");
      const s2Title = ws2.getCell("A1");
      s2Title.value = `RINGKASAN PERFORMA EVALUASI MUTU PER LABORATORIUM - SIKLUS: ${cycle.toUpperCase()}`;
      s2Title.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0F766E" } };
      s2Title.alignment = { horizontal: "center", vertical: "middle" };

      ws2.addRow([]);

      const s2Headers = [
        "No",
        "Kode Lab",
        "Nama Laboratorium",
        "Total Uji",
        "Memuaskan",
        "Peringatan",
        "Tidak Memuaskan",
        "Pass Rate (%)",
      ];
      const s2HeaderRow = ws2.addRow(s2Headers);
      s2HeaderRow.height = 24;
      s2HeaderRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "medium", color: { argb: "FF0F172A" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });

      const labMap = new Map<string, { code: string; name: string; total: number; sat: number; warn: number; unsat: number }>();
      filteredRecapData.forEach((d) => {
        if (!labMap.has(d.participantId)) {
          labMap.set(d.participantId, {
            code: d.participantCode,
            name: d.labName,
            total: 0,
            sat: 0,
            warn: 0,
            unsat: 0,
          });
        }
        const lab = labMap.get(d.participantId)!;
        if (d.participantValue !== null) {
          lab.total++;
          if (d.keterangan === "Memuaskan") lab.sat++;
          else if (d.keterangan === "Peringatan") lab.warn++;
          else if (d.keterangan === "Tidak Memuaskan") lab.unsat++;
        }
      });

      let s2Idx = 1;
      let totalAll = 0;
      let satAll = 0;
      let warnAll = 0;
      let unsatAll = 0;

      labMap.forEach((lab) => {
        const rate = lab.total > 0 ? ((lab.sat / lab.total) * 100).toFixed(1) : "0.0";
        totalAll += lab.total;
        satAll += lab.sat;
        warnAll += lab.warn;
        unsatAll += lab.unsat;

        const row = ws2.addRow([
          s2Idx++,
          lab.code,
          lab.name,
          lab.total,
          lab.sat,
          lab.warn,
          lab.unsat,
          `${rate}%`,
        ]);
        row.height = 20;
        row.eachCell((cell, colNum) => {
          cell.font = { name: "Arial", size: 9 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
          if ([1, 2, 4, 5, 6, 7, 8].includes(colNum)) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }
        });
      });

      const summaryRate = totalAll > 0 ? ((satAll / totalAll) * 100).toFixed(1) : "0.0";
      const totalRow = ws2.addRow([
        "",
        "",
        "TOTAL KESELURUHAN",
        totalAll,
        satAll,
        warnAll,
        unsatAll,
        `${summaryRate}%`,
      ]);
      totalRow.height = 22;
      totalRow.eachCell((cell) => {
        cell.font = { name: "Arial", size: 9.5, bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        cell.border = {
          top: { style: "double", color: { argb: "FF0F172A" } },
          bottom: { style: "double", color: { argb: "FF0F172A" } },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      totalRow.getCell(3).alignment = { horizontal: "left", vertical: "middle" };

      ws2.columns = [
        { width: 6 },
        { width: 14 },
        { width: 34 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 16 },
        { width: 16 },
      ];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rekap_Laporan_Hasil_PME_${cycle || "Semua"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Excel Berhasil!",
        description: `Rekapitulasi ${filteredRecapData.length} data berhasil diekspor ke Excel (.xlsx).`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Gagal Ekspor Excel",
        description: err.message || "Terjadi kesalahan saat memproses file Excel.",
        variant: "destructive",
      });
    } finally {
      setIsExportingRecapExcel(false);
    }
  };

  // Unduh PDF Rekap Laporan Hasil PME (Format Landscape Resmi)
  const handleDownloadRecapPdf = () => {
    try {
      setIsExportingRecapPdf(true);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 10;

      let y = 8;
      const logoSize = 16;

      if (kopSurat?.logoKiri) {
        try {
          doc.addImage(kopSurat.logoKiri, "PNG", margin, y, logoSize, logoSize);
        } catch {}
      }

      if (kopSurat?.logoKanan) {
        try {
          doc.addImage(kopSurat.logoKanan, "PNG", pageW - margin - logoSize, y, logoSize, logoSize);
        } catch {}
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(
        (kopSurat?.pemda || "KEMENTERIAN KESEHATAN REPUBLIK INDONESIA").toUpperCase(),
        pageW / 2,
        y + 3,
        { align: "center" }
      );

      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        (kopSurat?.namaRumahSakit || "BALAI BESAR LABORATORIUM KESEHATAN MASYARAKAT PALEMBANG").toUpperCase(),
        pageW / 2,
        y + 7.5,
        { align: "center" }
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(
        kopSurat?.alamatRumahSakit || "Jl. Inspektur Yazid No.2, Sekip Jaya, Palembang, Sumatera Selatan",
        pageW / 2,
        y + 11.5,
        { align: "center" }
      );
      doc.text(
        kopSurat?.kontakRumahSakit || "Telp: (0711) 352 683 | Email: bblabkesmaspalembang@kemkes.go.id",
        pageW / 2,
        y + 15,
        { align: "center" }
      );

      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.5);
      doc.line(margin, y + 17.5, pageW - margin, y + 17.5);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 18.2, pageW - margin, y + 18.2);

      y += 23;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text("REKAPITULASI LAPORAN HASIL PROGRAM EVALUASI MUTU EKSTERNAL (PME)", pageW / 2, y, { align: "center" });

      y += 4.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      const metaText = `Siklus: ${cycle || "-"} | Periode: ${recapPeriod === "ALL" ? "Semua" : recapPeriod} | Kategori: ${recapCategory === "ALL" ? "Semua" : recapCategory} | Total Uji: ${recapStats.totalTests} | Total Lab: ${recapStats.uniqueLabs} | Pass Rate: ${recapStats.passRate}%`;
      doc.text(metaText, pageW / 2, y, { align: "center" });

      const tableHead = [
        [
          "No",
          "Kode Lab",
          "Nama Laboratorium",
          "Kategori",
          "Parameter",
          "Satuan",
          "Hasil Lab",
          "Target",
          "SDPA",
          "Z-Score",
          "Status Kinerja",
          "Metode",
          "Alat",
          "Reagen",
        ],
      ];

      const tableBody = filteredRecapData.map((d, i) => [
        String(i + 1),
        d.participantCode,
        d.labName,
        d.category,
        d.parameterName,
        d.unit,
        d.participantValue !== null ? String(d.participantValue) : "-",
        d.target !== null ? String(d.target) : "-",
        d.sdpa !== null ? String(d.sdpa) : "-",
        d.zScore !== null ? `${d.zScore > 0 ? "+" : ""}${d.zScore.toFixed(2)}` : "-",
        d.keterangan,
        d.methodCode,
        d.instrumentCode,
        d.reagentName,
      ]);

      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: y + 3,
        margin: { left: margin, right: margin },
        styles: {
          font: "helvetica",
          fontSize: 6.5,
          cellPadding: 1.2,
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [15, 118, 110],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { cellWidth: 7, halign: "center" },
          1: { cellWidth: 14, halign: "center" },
          2: { cellWidth: 38 },
          3: { cellWidth: 18 },
          4: { cellWidth: 26 },
          5: { cellWidth: 12, halign: "center" },
          6: { cellWidth: 14, halign: "right" },
          7: { cellWidth: 14, halign: "right" },
          8: { cellWidth: 13, halign: "right" },
          9: { cellWidth: 13, halign: "center" },
          10: { cellWidth: 20, halign: "center" },
          11: { cellWidth: 26 },
          12: { cellWidth: 26 },
          13: { cellWidth: 36 },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 10) {
            const val = String(data.cell.raw);
            if (val === "Memuaskan") {
              data.cell.styles.textColor = [22, 101, 52];
              data.cell.styles.fontStyle = "bold";
            } else if (val === "Peringatan") {
              data.cell.styles.textColor = [146, 64, 14];
              data.cell.styles.fontStyle = "bold";
            } else if (val === "Tidak Memuaskan") {
              data.cell.styles.textColor = [153, 27, 27];
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
      });

      let finalY = (doc as any).lastAutoTable.finalY + 6;
      if (finalY > pageH - 35) {
        doc.addPage("a4", "landscape");
        finalY = 15;
      }

      const sigBlockW = 75;
      const sigX = pageW - margin - sigBlockW;
      let sigY = finalY;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`${signer.tempat || "Palembang"}, ${signer.tanggal || new Date().toLocaleDateString("id-ID")}`, sigX, sigY);
      sigY += 3.8;
      const splitJabatan = doc.splitTextToSize(signer.jabatan || "Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan", sigBlockW);
      doc.text(splitJabatan, sigX, sigY);
      sigY += (splitJabatan.length * 3.5) + 9;

      doc.setFont("times", "italic");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 118, 110);
      const cursiveName = signer.namaPejabat ? signer.namaPejabat.split(",")[0] : "Penyelenggara PME";
      doc.text(cursiveName, sigX, sigY);
      sigY += 4;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      const namaLengkap = signer.namaPejabat || "M.Didik Wahyudi, S.Tr.Kes";
      doc.text(namaLengkap, sigX, sigY);
      const nameW = doc.getTextWidth(namaLengkap);
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.2);
      doc.line(sigX, sigY + 0.5, sigX + nameW, sigY + 0.5);

      sigY += 3.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(`NIP. ${signer.nip || "-"}`, sigX, sigY);

      doc.save(`Rekap_Laporan_Hasil_PME_${cycle || "Semua"}.pdf`);
      toast({
        title: "Export PDF Berhasil!",
        description: "Berkas PDF rekap laporan hasil PME berhasil diunduh.",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Gagal Ekspor PDF",
        description: err.message || "Terjadi kesalahan saat memproses file PDF.",
        variant: "destructive",
      });
    } finally {
      setIsExportingRecapPdf(false);
    }
  };

  // Generate Official PDF Matching Kemenkes Labkesmas Palembang Format
  const handleDownloadPdf = (report: ParticipantReport) => {
    try {
      setIsExportingPdf(true);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;

      // 1. Header & Kop Surat
      let y = 10;
      const logoSize = 18;

      // Draw Logo Kiri
      if (kopSurat?.logoKiri) {
        try {
          doc.addImage(kopSurat.logoKiri, "PNG", margin, y, logoSize, logoSize);
        } catch {}
      }

      // Draw Logo Kanan
      if (kopSurat?.logoKanan) {
        try {
          doc.addImage(kopSurat.logoKanan, "PNG", pageW - margin - logoSize, y, logoSize, logoSize);
        } catch {}
      }

      // Center Official Instansi Texts
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(
        (kopSurat?.pemda || "KEMENTERIAN KESEHATAN REPUBLIK INDONESIA").toUpperCase(),
        pageW / 2,
        y + 3.5,
        { align: "center" }
      );

      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(
        (kopSurat?.namaRumahSakit || "BALAI BESAR LABORATORIUM KESEHATAN MASYARAKAT PALEMBANG").toUpperCase(),
        pageW / 2,
        y + 8.5,
        { align: "center" }
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        kopSurat?.alamatRumahSakit || "Jl. Inspektur Yazid No.2, Sekip Jaya, Palembang, Sumatera Selatan",
        pageW / 2,
        y + 13,
        { align: "center" }
      );
      doc.text(
        kopSurat?.kontakRumahSakit || "Telp: (0711) 352 683 | Email: bblabkesmaspalembang@kemkes.go.id",
        pageW / 2,
        y + 17,
        { align: "center" }
      );

      // Double Divider Lines beneath Kop Surat
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.6);
      doc.line(margin, y + 20, pageW - margin, y + 20);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 20.8, pageW - margin, y + 20.8);

      // Title Section
      y += 26;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      const titleText = `HASIL EVALUASI BIDANG PATOLOGI PARAMETER ${category === "ALL" ? "SEMUA BIDANG" : category.toUpperCase()} ${(report.cycle || cycle).toUpperCase()}`;
      doc.text(titleText, pageW / 2, y, { align: "center" });

      // Participant Metadata
      y += 6;
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text("Kode Peserta", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${report.participant.participantCode || "-"}`, margin + 25, y);

      y += 4.5;
      doc.setFont("helvetica", "bold");
      doc.text("Nama Peserta", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${report.participant.labName}`, margin + 25, y);

      y += 4.5;
      doc.setFont("helvetica", "bold");
      doc.text("Alamat Peserta", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${report.participant.address || "Sumatera Selatan"}`, margin + 25, y);

      // 2. Table Data Multi-Kelompok Format Kemenkes
      const tableHead = [
        [
          { content: "No", rowSpan: 2 },
          { content: "Parameter", rowSpan: 2 },
          { content: "Kode", colSpan: 2 },
          { content: "Hasil Saudara", rowSpan: 2 },
          { content: "Seluruh Peserta", colSpan: 5 },
          { content: "Kelompok Metode", colSpan: 5 },
          { content: "Kelompok Alat", colSpan: 5 },
        ],
        [
          { content: "Metode" },
          { content: "Alat" },
          { content: "n" },
          { content: "Target / Sdpa" },
          { content: "Z Score" },
          { content: "Kategori" },
          { content: "Keterangan" },
          { content: "n" },
          { content: "Target / Sdpa" },
          { content: "Z Score" },
          { content: "Kategori" },
          { content: "Keterangan" },
          { content: "n" },
          { content: "Target / Sdpa" },
          { content: "Z Score" },
          { content: "Kategori" },
          { content: "Keterangan" },
        ],
      ];

      const tableBody = report.rows.map((row) => [
        row.no,
        row.parameterName,
        row.methodCode,
        row.instrumentCode,
        row.participantValue !== null ? row.participantValue.toFixed(2) : "-",
        // Seluruh Peserta
        row.global.n > 0 ? row.global.n : "-",
        row.global.target !== null ? `${row.global.target.toFixed(2)}\n${row.global.sdpa !== null ? row.global.sdpa.toFixed(2) : "-"}` : "-",
        row.global.zScore !== null ? (row.global.zScore > 0 ? `+${row.global.zScore.toFixed(2)}` : row.global.zScore.toFixed(2)) : "-",
        row.global.category,
        row.global.keterangan,
        // Kelompok Metode
        row.method.n > 0 ? row.method.n : "-",
        row.method.isAnalyzed && row.method.target !== null ? `${row.method.target.toFixed(2)}\n${row.method.sdpa !== null ? row.method.sdpa.toFixed(2) : "-"}` : "-",
        row.method.isAnalyzed && row.method.zScore !== null ? (row.method.zScore > 0 ? `+${row.method.zScore.toFixed(2)}` : row.method.zScore.toFixed(2)) : "-",
        row.method.isAnalyzed ? row.method.category : "-",
        row.method.keterangan,
        // Kelompok Alat
        row.instrument.n > 0 ? row.instrument.n : "-",
        row.instrument.isAnalyzed && row.instrument.target !== null ? `${row.instrument.target.toFixed(2)}\n${row.instrument.sdpa !== null ? row.instrument.sdpa.toFixed(2) : "-"}` : "-",
        row.instrument.isAnalyzed && row.instrument.zScore !== null ? (row.instrument.zScore > 0 ? `+${row.instrument.zScore.toFixed(2)}` : row.instrument.zScore.toFixed(2)) : "-",
        row.instrument.isAnalyzed ? row.instrument.category : "-",
        row.instrument.keterangan,
      ]);

      autoTable(doc, {
        startY: y + 4,
        head: tableHead,
        body: tableBody,
        theme: "grid",
        styles: {
          fontSize: 6.5,
          cellPadding: 1.2,
          valign: "middle",
          halign: "center",
          textColor: [30, 41, 59],
          lineColor: [203, 213, 225],
          lineWidth: 0.15,
        },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 32, halign: "left", fontStyle: "bold" },
          2: { cellWidth: 10, halign: "center" },
          3: { cellWidth: 10, halign: "center" },
          4: { cellWidth: 15, halign: "center", fontStyle: "bold" },
        },
        didDrawPage: () => {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text(
            "* Hasil bersifat rahasia, hanya dapat diunduh oleh peserta melalui aplikasi menggunakan akun masing-masing",
            margin,
            pageH - 6
          );
        },
      });

      // Comments & Signature Section below table
      // @ts-ignore
      let finalY = (doc as any).lastAutoTable?.finalY + 5 || y + 80;
      if (finalY > pageH - 45) {
        doc.addPage("a4", "landscape");
        finalY = 20;
      }

      // Komentar / Saran
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text("Komentar / Saran", margin, finalY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      let cY = finalY + 4;
      report.comments.forEach((c) => {
        doc.text(`• ${c}`, margin + 2, cY);
        cY += 3.8;
      });

      // Signature Block Dinamis dari Data Penandatangan di Bagian Kanan Bawah
      const sigBlockW = 75;
      const sigX = pageW - margin - sigBlockW;
      let sigY = finalY + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(`${signer.tempat || "OKU Timur"}, ${signer.tanggal || "14 November 2027"}`, sigX, sigY);
      sigY += 4;
      const splitJabatan = doc.splitTextToSize(signer.jabatan || "Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan", sigBlockW);
      doc.text(splitJabatan, sigX, sigY);
      sigY += (splitJabatan.length * 3.8) + 8;
      
      // Tanda tangan nama singkat / cursive
      doc.setFont("times", "italic");
      doc.setFontSize(10.5);
      doc.setTextColor(15, 118, 110);
      const cursiveName = signer.namaPejabat ? signer.namaPejabat.split(",")[0] : "M.Didik Wahyudi";
      doc.text(cursiveName, sigX, sigY);
      sigY += 4.5;

      // Nama Pejabat Lengkap dengan Gelar & Garis Bawah
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      const namaLengkap = signer.namaPejabat || "M.Didik Wahyudi, S.Tr.Kes";
      doc.text(namaLengkap, sigX, sigY);
      const nameW = doc.getTextWidth(namaLengkap);
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.2);
      doc.line(sigX, sigY + 0.6, sigX + nameW, sigY + 0.6);
      sigY += 4;

      // NIP
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`NIP ${signer.nip || "198408152009041001"}`, sigX, sigY);

      doc.save(`Laporan_PME_${report.participant.labName.replace(/\s+/g, "_")}_${cycle.replace(/\s+/g, "_")}.pdf`);
      toast({ title: "PDF Berhasil Diunduh", description: "Format lembar evaluasi resmi Kemenkes telah tersimpan." });
    } catch (err) {
      toast({ title: "Gagal membuat PDF", description: String(err), variant: "destructive" });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const activeReport = participantReports.length > 0 ? participantReports[0] : null;

  // Filter Baris Hasil Evaluasi Berdasarkan Status, Parameter, dan Kata Kunci Search
  const filterRows = (rows: EvaluationRow[]) => {
    return rows.filter((row) => {
      // Filter Parameter
      if (parameterFilter !== "ALL" && row.parameterName !== parameterFilter) {
        return false;
      }
      // Filter Status Evaluasi
      if (statusFilter === "SATISFACTORY" && row.global.keterangan !== "Memuaskan") {
        return false;
      }
      if (statusFilter === "WARNING" && row.global.keterangan !== "Peringatan") {
        return false;
      }
      if (statusFilter === "UNSATISFACTORY" && row.global.keterangan !== "Tidak Memuaskan") {
        return false;
      }
      if (statusFilter === "OUTLIER" && !row.outlierStatus.includes("Outlier")) {
        return false;
      }
      // Filter Pencarian
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = row.parameterName.toLowerCase().includes(query);
        const matchMethod = row.methodCode.toLowerCase().includes(query);
        const matchInstrument = row.instrumentCode.toLowerCase().includes(query);
        if (!matchName && !matchMethod && !matchInstrument) return false;
      }
      return true;
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
              <FileBarChart className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Laporan Hasil PME</h1>
                {isSuperAdmin ? (
                  <Badge variant="outline" className="bg-teal-600 text-white border-none text-[10px] font-mono">
                    Superadmin Mode
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-blue-600 text-white border-none text-[10px] font-mono">
                    Laboratorium Peserta
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isSuperAdmin
                  ? "Validasi, koreksi hasil biostatistik ISO 13528, penandatanganan resmi, dan pengiriman laporan ke peserta"
                  : "Lembar evaluasi mutu resmi hasil uji PME laboratorium yang diterbitkan oleh Balai Penyelenggara"}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons Header */}
        <div className="flex flex-wrap items-center gap-2 no-print">
          {/* Tombol Atur KOP Surat (Khusus Superadmin) */}
          {isSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsKopSuratModalOpen(true);
              }}
              className="text-xs border-teal-600/40 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"
            >
              <Building2 className="mr-1.5 h-3.5 w-3.5 text-teal-600" />
              Pengaturan KOP Surat
            </Button>
          )}

          {/* Tombol Atur Penandatangan (Superadmin) */}
          {isSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSignerForm({ ...signer });
                setIsSignerModalOpen(true);
              }}
              className="text-xs border-teal-600/40 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"
            >
              <PenLine className="mr-1.5 h-3.5 w-3.5 text-teal-600" />
              Penandatangan
            </Button>
          )}

          {/* Tombol Validasi / Selesai (Superadmin) */}
          {isSuperAdmin && activeReport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleValidateReport}
              disabled={validating || loading}
              className="text-xs border-blue-600/40 text-blue-800 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            >
              {validating ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-blue-600" />
              ) : (
                <FileCheck2 className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
              )}
              {activeReport.isValidated ? "Validasi Ulang" : "Validasi / Selesai"}
            </Button>
          )}

          {/* Tombol Kirim Laporan ke Peserta (Superadmin) */}
          {isSuperAdmin && activeReport && (
            <Button
              size="sm"
              onClick={() => setIsPublishModalOpen(true)}
              disabled={publishing || loading}
              className={`text-xs ${
                activeReport.isPublished
                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                  : "bg-teal-700 hover:bg-teal-800 text-white"
              }`}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {activeReport.isPublished ? "Kirim Ulang ke Peserta" : "Kirim Laporan"}
            </Button>
          )}

          {/* Tombol Tarik / Batalkan Laporan (Khusus Superadmin) */}
          {isSuperAdmin && activeReport && (activeReport.isPublished || activeReport.isValidated) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRetractModalOpen(true)}
              disabled={retracting || loading}
              className="text-xs border-amber-600/50 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              {retracting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-amber-600" />
              ) : (
                <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
              )}
              Tarik / Batalkan Laporan
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={handlePrint} className="text-xs">
            <Printer className="mr-1.5 h-4 w-4 text-teal-700" />
            Cetak Halaman
          </Button>

          {activeReport && (
            <Button
              size="sm"
              onClick={() => handleDownloadPdf(activeReport)}
              disabled={isExportingPdf}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
            >
              {isExportingPdf ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
              Unduh PDF Resmi
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner Validasi & Pengiriman ke Peserta */}
      {activeReport && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border bg-card shadow-xs no-print">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-muted-foreground">Status Laporan:</span>
            {activeReport.isPublished ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] gap-1.5 px-2.5 py-0.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Terkirim ke Akun Peserta
                {activeReport.publishedAt && (
                  <span className="font-normal opacity-90">
                    ({new Date(activeReport.publishedAt).toLocaleDateString("id-ID")})
                  </span>
                )}
              </Badge>
            ) : activeReport.isValidated ? (
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-[11px] gap-1.5 px-2.5 py-0.5">
                <FileCheck2 className="h-3.5 w-3.5" />
                Dinyatakan Valid / Selesai (Siap Kirim)
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-medium text-[11px] gap-1.5 px-2.5 py-0.5">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                Menunggu Koreksi & Validasi
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium">
              Penandatangan: <strong className="text-foreground">{signer.namaPejabat}</strong> ({signer.tempat})
            </span>
          </div>
        </div>
      )}

      {/* Filter Control Bar (No Print) */}
      <Card className="shadow-xs border no-print">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
            {/* Filter Siklus */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  <span>Siklus PME</span>
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setCustomCycleMode(!customCycleMode);
                    if (!customCycleMode) setCustomCycleInput(cycle);
                  }}
                  className="text-[10px] text-blue-600 hover:underline"
                >
                  {customCycleMode ? "Pilih Siklus" : "Ketik Manual"}
                </button>
              </div>

              {customCycleMode ? (
                <div className="flex gap-1.5">
                  <Input
                    value={customCycleInput}
                    onChange={(e) => setCustomCycleInput(e.target.value)}
                    placeholder="Misal: Siklus 1 2027"
                    className="h-8 text-xs font-medium"
                    onKeyDown={(e) => e.key === "Enter" && handleApplyCustomCycle()}
                  />
                  <Button
                    size="sm"
                    className="h-8 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleApplyCustomCycle}
                  >
                    Terapkan
                  </Button>
                </div>
              ) : (
                <Select value={cycle} onValueChange={handleCycleSelect}>
                  <SelectTrigger className="h-8 text-xs font-medium">
                    <SelectValue placeholder="Pilih Siklus" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCycles.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs font-medium">
                        {c}
                      </SelectItem>
                    ))}
                    {cycle && !availableCycles.includes(cycle) && (
                      <SelectItem value={cycle} className="text-xs font-medium">
                        {cycle}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Filter Kategori */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-teal-600" />
                <span>Kategori Paket</span>
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Kategori</SelectItem>
                  <SelectItem value="Kimia Klinik">Kimia Klinik</SelectItem>
                  <SelectItem value="Hematologi">Hematologi</SelectItem>
                  <SelectItem value="Imunologi">Imunologi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Peserta */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-amber-600" />
                <span>Pilih Peserta</span>
              </Label>
              <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Semua Peserta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Peserta ({participantReports.length})</SelectItem>
                  {participantReports.map((pr) => (
                    <SelectItem key={pr.participant.id} value={pr.participant.id} className="text-xs">
                      {pr.participant.participantCode ? `[${pr.participant.participantCode}] ` : ""}
                      {pr.participant.labName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Parameter Uji */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-indigo-600" />
                <span>Parameter Uji</span>
              </Label>
              <Select value={parameterFilter} onValueChange={setParameterFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Semua Parameter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Parameter ({availableParameters.length})</SelectItem>
                  {availableParameters.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs font-medium">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Baris Kedua Filter: Status Evaluasi & Pencarian Cepat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1 border-t items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-purple-600" />
                <span>Status Evaluasi</span>
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="SATISFACTORY">Hanya Memuaskan (OK)</SelectItem>
                  <SelectItem value="WARNING">Hanya Peringatan ($)</SelectItem>
                  <SelectItem value="UNSATISFACTORY">Hanya Tidak Memuaskan (ACTION)</SelectItem>
                  <SelectItem value="OUTLIER">Hanya Outlier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-slate-500" />
                <span>Pencarian Cepat Parameter / Kode</span>
              </Label>
              <div className="relative">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ketik nama parameter (contoh: Glukosa, Kolesterol), metode, atau alat..."
                  className="h-8 text-xs pl-8 font-medium"
                />
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-2 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Bersihkan
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Biostatistical Summary Banner */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 no-print">
          <Card className="p-3 border shadow-xs bg-card">
            <p className="text-[11px] text-muted-foreground font-medium">Peserta Terdaftar</p>
            <h4 className="text-xl font-bold mt-1 text-foreground">{summary.totalParticipants} Lab</h4>
          </Card>
          <Card className="p-3 border shadow-xs bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/20">
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Memuaskan (|Z| ≤ 2)</p>
            <h4 className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{summary.totalSatisfactory}</h4>
          </Card>
          <Card className="p-3 border shadow-xs bg-amber-50/50 dark:bg-amber-950/20 border-amber-500/20">
            <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Peringatan (2 &lt; |Z| &lt; 3)</p>
            <h4 className="text-xl font-bold mt-1 text-amber-700 dark:text-amber-400">{summary.totalWarning}</h4>
          </Card>
          <Card className="p-3 border shadow-xs bg-red-50/50 dark:bg-red-950/20 border-red-500/20">
            <p className="text-[11px] text-red-700 dark:text-red-400 font-medium">Tdk Memuaskan (|Z| ≥ 3)</p>
            <h4 className="text-xl font-bold mt-1 text-red-700 dark:text-red-400">{summary.totalUnsatisfactory}</h4>
          </Card>
          <Card className="p-3 border shadow-xs bg-purple-50/50 dark:bg-purple-950/20 border-purple-500/20 col-span-2 sm:col-span-1">
            <p className="text-[11px] text-purple-700 dark:text-purple-400 font-medium">Tingkat Kelulusan</p>
            <h4 className="text-xl font-bold mt-1 text-purple-700 dark:text-purple-400">{summary.passRate}%</h4>
          </Card>
        </div>
      )}

      {/* Tabs Laporan */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 no-print">
          <TabsTrigger value="report" className="text-xs flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-teal-600" />
            <span>Lembar Laporan Resmi Kemenkes</span>
          </TabsTrigger>
          <TabsTrigger value="recap" className="text-xs flex items-center gap-1.5">
            <FileBarChart className="h-3.5 w-3.5 text-emerald-600" />
            <span>Rekap Laporan Hasil PME</span>
          </TabsTrigger>
          <TabsTrigger value="comprehensive" className="text-xs flex items-center gap-1.5">
            <TableProperties className="h-3.5 w-3.5 text-indigo-600" />
            <span>Tabel Statistik Lengkap (Bias%, TE, CV, Outlier, Z-Score)</span>
          </TabsTrigger>
          <TabsTrigger value="biostats" className="text-xs flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-blue-600" />
            <span>Dashboard Biostatistik ISO 13528 & Dixon</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: LEMBAR EVALUASI RESMI FORMAT KEMENKES LABKESMAS PALEMBANG I */}
        <TabsContent value="report" className="space-y-6">
          {loading ? (
            <Card className="p-12 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-teal-600" />
              <span>Menghitung biostatistik ISO 13528 & menyusun laporan resmi...</span>
            </Card>
          ) : isParticipant && participantReports.length === 0 && participantNotice ? (
            <Card className="p-10 text-center space-y-4 border-dashed border-2 bg-amber-50/20 border-amber-400/40">
              <div className="p-3 bg-amber-500/10 text-amber-600 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
                <Clock className="h-6 w-6" />
              </div>
              <div className="max-w-lg mx-auto">
                <h3 className="text-base font-bold text-foreground">Laporan Dalam Tahap Evaluasi Mutu</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{participantNotice}</p>
              </div>
            </Card>
          ) : participantReports.length === 0 ? (
            <Card className="p-8 text-center space-y-4 border-dashed border-2">
              <div className="p-3 bg-amber-500/10 text-amber-600 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Tidak Ditemukan Hasil PME untuk {cycle || "Siklus Ini"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Belum ada data hasil pemeriksaan PME pada filter siklus dan kategori terpilih.
                </p>
              </div>

              {availableCycles.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Siklus yang memiliki data di sistem:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {availableCycles.map((c) => (
                      <Button
                        key={c}
                        size="sm"
                        variant={c === cycle ? "default" : "outline"}
                        className={`text-xs h-7 ${c === cycle ? "bg-teal-700 hover:bg-teal-800 text-white" : ""}`}
                        onClick={() => handleCycleSelect(c)}
                      >
                        <Calendar className="mr-1.5 h-3 w-3" />
                        {c} {c === cycle ? "(Aktif)" : "→ Beralih"}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-wrap justify-center gap-2">
                {category !== "ALL" && (
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setCategory("ALL")}>
                    Tampilkan Semua Kategori
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button
                    size="sm"
                    variant="default"
                    className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
                    onClick={() => navigate("pme-input")}
                  >
                    Buka Menu Input Hasil PME
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            participantReports.map((report) => {
              const displayRows = filterRows(report.rows);

              return (
                <div
                  key={report.participant.id}
                  ref={printAreaRef}
                  className="relative bg-white text-black p-8 rounded-xl shadow-md border print:border-none print:shadow-none print:p-0 print:m-0 overflow-hidden"
                >
                  {/* Watermark Diagonal RAHASIA */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none overflow-hidden">
                    <span className="text-[130px] font-extrabold text-red-500/10 dark:text-red-500/5 rotate-[-25deg] tracking-widest uppercase">
                      RAHASIA
                    </span>
                  </div>

                  {/* Header Instansi Penyelenggara (KOP Surat Resmi) */}
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-4">
                    {/* Logo Kiri */}
                    <div className="w-20 h-20 flex items-center justify-center shrink-0">
                      {kopSurat?.logoKiri ? (
                        <img
                          src={kopSurat.logoKiri}
                          alt="Logo Kiri"
                          className="max-h-20 max-w-20 object-contain"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-700 border border-teal-500/20">
                          <ShieldCheck className="h-9 w-9 text-teal-700" />
                        </div>
                      )}
                    </div>

                    {/* Teks Tengah KOP Surat */}
                    <div className="flex-1 text-center px-4 space-y-0.5">
                      <h2 className="text-xs sm:text-sm font-bold tracking-wider text-slate-800 uppercase">
                        {kopSurat?.pemda || "Kementerian Kesehatan Republik Indonesia"}
                      </h2>
                      <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 uppercase">
                        {kopSurat?.namaRumahSakit || "Balai Besar Laboratorium Kesehatan Masyarakat (Labkesmas Palembang I)"}
                      </h1>
                      <p className="text-[11px] text-slate-600 font-normal leading-tight">
                        {kopSurat?.alamatRumahSakit || "Jl. Inspektur Yazid No.2, Sekip Jaya, Palembang, Sumatera Selatan"}
                      </p>
                      <p className="text-[10px] text-slate-600 font-medium">
                        {kopSurat?.kontakRumahSakit || "Telp: (0711) 352 683 | Email: bblabkesmaspalembang@kemkes.go.id"}
                      </p>
                    </div>

                    {/* Logo Kanan */}
                    <div className="w-20 h-20 flex items-center justify-center shrink-0">
                      {kopSurat?.logoKanan ? (
                        <img
                          src={kopSurat.logoKanan}
                          alt="Logo Kanan"
                          className="max-h-20 max-w-20 object-contain"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-dashed border-slate-300">
                          <Award className="h-8 w-8 text-slate-400" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Metadata Peserta */}
                  <div className="my-5 text-center">
                    <h3 className="text-sm font-extrabold tracking-wide uppercase text-slate-900">
                      HASIL EVALUASI BIDANG PATOLOGI PARAMETER {category === "ALL" ? "SEMUA BIDANG" : category.toUpperCase()} {cycle.toUpperCase()}
                    </h3>
                  </div>

                  <div className="mb-4 text-xs grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <span className="w-28 font-bold text-gray-700">Kode Peserta:</span>
                        <span className="font-mono font-bold text-teal-800">
                          {report.participant.participantCode || "-"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="w-28 font-bold text-gray-700">Nama Peserta:</span>
                        <span className="font-semibold text-slate-900">{report.participant.labName}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <span className="w-28 font-bold text-gray-700">Alamat Peserta:</span>
                        <span className="text-gray-700">{report.participant.address || "Sumatera Selatan"}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="w-28 font-bold text-gray-700">Waktu Pengiriman:</span>
                        <span className="text-gray-600 font-mono">
                          {new Date(report.submittedAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Table Format Multi-kelompok Standar Kemenkes */}
                  <div className="overflow-x-auto border border-slate-300 rounded-lg">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 text-center">
                          <th rowSpan={2} className="p-2 border-r border-slate-300 w-9">No</th>
                          <th rowSpan={2} className="p-2 border-r border-slate-300 min-w-[130px] text-left">Parameter</th>
                          <th colSpan={2} className="p-1.5 border-r border-slate-300">Kode</th>
                          <th rowSpan={2} className="p-2 border-r border-slate-300 w-20">Hasil Saudara</th>
                          <th colSpan={5} className="p-1.5 border-r border-slate-300 bg-teal-50/50">Seluruh Peserta</th>
                          <th colSpan={5} className="p-1.5 border-r border-slate-300 bg-blue-50/50">Kelompok Metode</th>
                          <th colSpan={5} className="p-1.5 bg-purple-50/50">Kelompok Alat</th>
                        </tr>
                        <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-semibold text-slate-700 text-center">
                          {/* Kode */}
                          <th className="p-1 border-r border-slate-300 w-12">Metode</th>
                          <th className="p-1 border-r border-slate-300 w-12">Alat</th>
                          {/* Seluruh Peserta */}
                          <th className="p-1 border-r border-slate-300 w-9 bg-teal-50/50">n</th>
                          <th className="p-1 border-r border-slate-300 w-20 bg-teal-50/50">Target<br />Sdpa</th>
                          <th className="p-1 border-r border-slate-300 w-14 bg-teal-50/50">Z Score</th>
                          <th className="p-1 border-r border-slate-300 w-14 bg-teal-50/50">Kategori</th>
                          <th className="p-1 border-r border-slate-300 w-22 bg-teal-50/50">Keterangan</th>
                          {/* Kelompok Metode */}
                          <th className="p-1 border-r border-slate-300 w-9 bg-blue-50/50">n</th>
                          <th className="p-1 border-r border-slate-300 w-20 bg-blue-50/50">Target<br />Sdpa</th>
                          <th className="p-1 border-r border-slate-300 w-14 bg-blue-50/50">Z Score</th>
                          <th className="p-1 border-r border-slate-300 w-14 bg-blue-50/50">Kategori</th>
                          <th className="p-1 border-r border-slate-300 w-22 bg-blue-50/50">Keterangan</th>
                          {/* Kelompok Alat */}
                          <th className="p-1 border-r border-slate-300 w-9 bg-purple-50/50">n</th>
                          <th className="p-1 border-r border-slate-300 w-20 bg-purple-50/50">Target<br />Sdpa</th>
                          <th className="p-1 border-r border-slate-300 w-14 bg-purple-50/50">Z Score</th>
                          <th className="p-1 border-r border-slate-300 w-14 bg-purple-50/50">Kategori</th>
                          <th className="p-1 bg-purple-50/50 w-22">Keterangan</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {displayRows.length === 0 ? (
                          <tr>
                            <td colSpan={20} className="p-6 text-center text-muted-foreground italic text-xs">
                              Tidak ada parameter yang cocok dengan filter saat ini.
                            </td>
                          </tr>
                        ) : (
                          displayRows.map((row) => {
                            const isWarn = row.global.keterangan === "Peringatan";
                            const isAction = row.global.keterangan === "Tidak Memuaskan";

                            return (
                              <tr
                                key={row.no}
                                className={`text-slate-800 hover:bg-slate-50/60 ${
                                  isAction ? "bg-red-50/40" : isWarn ? "bg-amber-50/30" : ""
                                }`}
                              >
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono">{row.no}</td>
                                <td className="p-1.5 border-r border-slate-200 font-semibold">{row.parameterName}</td>
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono">{row.methodCode}</td>
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono">{row.instrumentCode}</td>
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono font-bold">
                                  {row.participantValue !== null ? row.participantValue.toFixed(2) : "-"}
                                </td>

                                {/* Seluruh Peserta */}
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono">
                                  {row.global.n > 0 ? row.global.n : "-"}
                                </td>
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono leading-tight">
                                  {row.global.target !== null ? (
                                    <div>
                                      <span className="font-bold">{row.global.target.toFixed(2)}</span>
                                      <div className="text-[9.5px] text-gray-500 border-t border-dotted border-gray-300 mt-0.5">
                                        {row.global.sdpa !== null ? row.global.sdpa.toFixed(2) : "-"}
                                      </div>
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono font-bold">
                                  <span className={isAction ? "text-red-700" : isWarn ? "text-amber-700" : "text-emerald-700"}>
                                    {row.global.zScore !== null ? (row.global.zScore > 0 ? `+${row.global.zScore.toFixed(2)}` : row.global.zScore.toFixed(2)) : "-"}
                                  </span>
                                </td>
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono font-semibold">
                                  {row.global.category}
                                </td>
                                <td className="p-1.5 text-center border-r border-slate-200 text-[10px] font-medium">
                                  {row.global.keterangan}
                                </td>

                                {/* Kelompok Metode */}
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono">
                                  {row.method.n > 0 ? row.method.n : "-"}
                                </td>
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono leading-tight">
                                  {row.method.isAnalyzed && row.method.target !== null ? (
                                    <div>
                                      <span className="font-bold">{row.method.target.toFixed(2)}</span>
                                      <div className="text-[9.5px] text-gray-500 border-t border-dotted border-gray-300 mt-0.5">
                                        {row.method.sdpa !== null ? row.method.sdpa.toFixed(2) : "-"}
                                      </div>
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono">
                                  {row.method.isAnalyzed && row.method.zScore !== null
                                    ? row.method.zScore > 0 ? `+${row.method.zScore.toFixed(2)}` : row.method.zScore.toFixed(2)
                                    : "-"}
                                </td>
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono">
                                  {row.method.isAnalyzed ? row.method.category : "-"}
                                </td>
                                <td className="p-1.5 text-center border-r border-slate-200 text-[10px]">
                                  {row.method.keterangan}
                                </td>

                                {/* Kelompok Alat */}
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono">
                                  {row.instrument.n > 0 ? row.instrument.n : "-"}
                                </td>
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono leading-tight">
                                  {row.instrument.isAnalyzed && row.instrument.target !== null ? (
                                    <div>
                                      <span className="font-bold">{row.instrument.target.toFixed(2)}</span>
                                      <div className="text-[9.5px] text-gray-500 border-t border-dotted border-gray-300 mt-0.5">
                                        {row.instrument.sdpa !== null ? row.instrument.sdpa.toFixed(2) : "-"}
                                      </div>
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono">
                                  {row.instrument.isAnalyzed && row.instrument.zScore !== null
                                    ? row.instrument.zScore > 0 ? `+${row.instrument.zScore.toFixed(2)}` : row.instrument.zScore.toFixed(2)
                                    : "-"}
                                </td>
                                <td className="p-1.5 text-center border-r border-slate-200 font-mono">
                                  {row.instrument.isAnalyzed ? row.instrument.category : "-"}
                                </td>
                                <td className="p-1.5 text-center text-[10px]">
                                  {row.instrument.keterangan}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Komentar / Saran & Pengesahan Dinamis */}
                  <div className="mt-6 pt-2 flex flex-row justify-between items-start gap-6 text-xs text-slate-800 print:flex-row print:justify-between">
                    <div className="space-y-1.5 max-w-lg">
                      <h4 className="font-bold text-slate-900">Komentar / Saran</h4>
                      <div className="text-[11px] text-gray-700 space-y-1 leading-relaxed">
                        {report.comments.map((c, i) => (
                          <p key={i}>• {c}</p>
                        ))}
                      </div>
                    </div>

                    {/* Kolom Tanda Tangan Dinamis - Posisi Kanan Bawah */}
                    <div className="ml-auto text-left min-w-[270px] max-w-xs space-y-1 text-slate-900 print:text-left print:ml-auto">
                      <p className="font-medium">{signer.tempat || "OKU Timur"}, {signer.tanggal || "14 November 2027"}</p>
                      <p className="text-[11px] text-gray-600 leading-snug">{signer.jabatan || "Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan"}</p>
                      <div className="h-12 flex items-center justify-start py-1">
                        <span className="font-serif italic text-teal-800 text-lg font-semibold tracking-wide">
                          {signer.namaPejabat?.split(",")[0] || "M.Didik Wahyudi"}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 underline underline-offset-2">{signer.namaPejabat || "M.Didik Wahyudi, S.Tr.Kes"}</p>
                      <p className="text-[11px] text-slate-700 font-mono">NIP {signer.nip || "198408152009041001"}</p>
                    </div>
                  </div>

                  <div className="mt-8 pt-3 border-t text-[10px] text-gray-400 flex justify-between items-center italic">
                    <span>* Hasil bersifat rahasia, hanya dapat diunduh oleh peserta melalui aplikasi menggunakan akun masing-masing</span>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* TAB 2: TABEL STATISTIK LENGKAP (Bias%, TE, CV, Outlier, Zscore) */}
        <TabsContent value="comprehensive" className="space-y-6 no-print">
          <Card className="shadow-sm border">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TableProperties className="h-4 w-4 text-indigo-600" />
                    <span>Rekapitulasi Statistik Lengkap Parameter Peserta</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Rincian metrik analitik: Bias % Global/Metode/Alat, Koefisien Variasi (CV %), Total Error (TE %), Status Outlier Tukey & Dixon Q-Test, dan Z-Score
                  </CardDescription>
                </div>
                {activeReport && (
                  <Badge variant="outline" className="text-xs font-mono">
                    {activeReport.participant.labName} ({activeReport.rows.length} Parameter)
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {participantReports.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground italic text-xs">
                  Tidak ada data untuk ditampilkan pada filter ini.
                </div>
              ) : (
                participantReports.map((report) => {
                  const displayRows = filterRows(report.rows);

                  return (
                    <div key={report.participant.id} className="overflow-x-auto">
                      <div className="bg-slate-50 dark:bg-slate-900/60 px-4 py-2 border-b flex items-center justify-between text-xs font-semibold">
                        <span className="text-teal-800 dark:text-teal-300">
                          {report.participant.participantCode ? `[${report.participant.participantCode}] ` : ""}
                          {report.participant.labName}
                        </span>
                        <span className="text-muted-foreground font-mono">
                          Siklus: {report.cycle} | Total Ditampilkan: {displayRows.length} Parameter
                        </span>
                      </div>

                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-muted/70 text-slate-700 dark:text-slate-300 font-semibold border-b text-[11px]">
                          <tr>
                            <th className="p-2.5 w-10 text-center">No</th>
                            <th className="p-2.5 min-w-[140px]">Parameter</th>
                            <th className="p-2.5 w-16 text-center">Hasil Lab</th>
                            <th className="p-2.5 w-20 text-center">Target Global</th>
                            <th className="p-2.5 w-20 text-center font-bold text-teal-800 dark:text-teal-300">Bias Global %</th>
                            <th className="p-2.5 w-20 text-center">Bias Metode %</th>
                            <th className="p-2.5 w-20 text-center">Bias Alat %</th>
                            <th className="p-2.5 w-16 text-center font-mono">CV Ref %</th>
                            <th className="p-2.5 w-20 text-center font-bold text-indigo-700 dark:text-indigo-400">Total Error (TE %)</th>
                            <th className="p-2.5 w-24 text-center">Status Outlier</th>
                            <th className="p-2.5 w-20 text-center font-bold text-teal-700 dark:text-teal-400">Z-Score Global</th>
                            <th className="p-2.5 w-20 text-center">Z-Score Metode</th>
                            <th className="p-2.5 w-20 text-center">Z-Score Alat</th>
                            <th className="p-2.5 w-24 text-center">Kategori Evaluasi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 text-[11.5px]">
                          {displayRows.length === 0 ? (
                            <tr>
                              <td colSpan={14} className="p-6 text-center text-muted-foreground italic">
                                Tidak ada parameter yang cocok dengan filter.
                              </td>
                            </tr>
                          ) : (
                            displayRows.map((row) => {
                              const isAction = row.global.keterangan === "Tidak Memuaskan";
                              const isWarn = row.global.keterangan === "Peringatan";

                              return (
                                <tr
                                  key={row.no}
                                  className={`hover:bg-muted/30 transition-colors ${
                                    isAction ? "bg-red-50/40 dark:bg-red-950/20" : isWarn ? "bg-amber-50/30 dark:bg-amber-950/20" : ""
                                  }`}
                                >
                                  <td className="p-2 text-center text-muted-foreground font-mono">{row.no}</td>
                                  <td className="p-2">
                                    <span className="font-semibold text-foreground">{row.parameterName}</span>
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                      {row.unit || "-"} | M: {row.methodCode} | A: {row.instrumentCode}
                                    </div>
                                  </td>
                                  <td className="p-2 text-center font-mono font-bold">
                                    {row.participantValue !== null ? row.participantValue.toFixed(2) : "-"}
                                  </td>
                                  <td className="p-2 text-center font-mono">
                                    {row.global.target !== null ? row.global.target.toFixed(2) : "-"}
                                  </td>
                                  {/* Bias Global % */}
                                  <td className="p-2 text-center font-mono font-semibold">
                                    {row.biasPercent !== null ? (
                                      <span
                                        className={
                                          Math.abs(row.biasPercent) > 10
                                            ? "text-red-600 font-bold"
                                            : Math.abs(row.biasPercent) > 5
                                            ? "text-amber-600"
                                            : "text-emerald-600"
                                        }
                                      >
                                        {row.biasPercent > 0 ? `+${row.biasPercent.toFixed(2)}%` : `${row.biasPercent.toFixed(2)}%`}
                                      </span>
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                  {/* Bias Metode % */}
                                  <td className="p-2 text-center font-mono">
                                    {row.biasMethodPercent !== null ? (
                                      row.biasMethodPercent > 0 ? `+${row.biasMethodPercent.toFixed(2)}%` : `${row.biasMethodPercent.toFixed(2)}%`
                                    ) : (
                                      <span className="text-muted-foreground text-[10px]">n &lt; 6</span>
                                    )}
                                  </td>
                                  {/* Bias Alat % */}
                                  <td className="p-2 text-center font-mono">
                                    {row.biasInstrumentPercent !== null ? (
                                      row.biasInstrumentPercent > 0 ? `+${row.biasInstrumentPercent.toFixed(2)}%` : `${row.biasInstrumentPercent.toFixed(2)}%`
                                    ) : (
                                      <span className="text-muted-foreground text-[10px]">n &lt; 6</span>
                                    )}
                                  </td>
                                  {/* CV Ref % */}
                                  <td className="p-2 text-center font-mono">
                                    {row.cvPercent !== null ? `${row.cvPercent.toFixed(2)}%` : "-"}
                                  </td>
                                  {/* Total Error (TE %) */}
                                  <td className="p-2 text-center font-mono font-bold text-indigo-700 dark:text-indigo-400">
                                    {row.totalErrorPercent !== null ? `${row.totalErrorPercent.toFixed(2)}%` : "-"}
                                  </td>
                                  {/* Status Outlier */}
                                  <td className="p-2 text-center text-[10.5px]">
                                    {row.outlierStatus !== "NORMAL" ? (
                                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 text-[10px]">
                                        {row.outlierStatus}
                                      </Badge>
                                    ) : (
                                      <span className="text-emerald-600 font-medium">Normal</span>
                                    )}
                                  </td>
                                  {/* Z-Score Global */}
                                  <td className="p-2 text-center font-mono font-bold">
                                    <span className={isAction ? "text-red-700" : isWarn ? "text-amber-700" : "text-emerald-700"}>
                                      {row.global.zScore !== null ? (row.global.zScore > 0 ? `+${row.global.zScore.toFixed(2)}` : row.global.zScore.toFixed(2)) : "-"}
                                    </span>
                                  </td>
                                  {/* Z-Score Metode */}
                                  <td className="p-2 text-center font-mono">
                                    {row.method.zScore !== null ? (row.method.zScore > 0 ? `+${row.method.zScore.toFixed(2)}` : row.method.zScore.toFixed(2)) : "-"}
                                  </td>
                                  {/* Z-Score Alat */}
                                  <td className="p-2 text-center font-mono">
                                    {row.instrument.zScore !== null ? (row.instrument.zScore > 0 ? `+${row.instrument.zScore.toFixed(2)}` : row.instrument.zScore.toFixed(2)) : "-"}
                                  </td>
                                  {/* Kategori Evaluasi */}
                                  <td className="p-2 text-center">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        isAction
                                          ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                                          : isWarn
                                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                      }`}
                                    >
                                      {row.global.keterangan}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: DASHBOARD STATISTIK & DETEKSI OUTLIER (ISO 13528 / DIXON) */}
        <TabsContent value="biostats" className="space-y-6 no-print">
          <Card className="shadow-sm border">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold">Tabel Analisis Biostatistik Robust ISO 13528 & Deteksi Pencilan</CardTitle>
              <CardDescription className="text-xs">
                Perhitungan nilai target ($X_{'{pt}'}$ Median), IQR, SDPA, Robust SD Algoritma A, dan Uji Dixon Q-Test
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/60 text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-2.5 w-10 text-center">No</th>
                      <th className="p-2.5 min-w-[140px]">Parameter</th>
                      <th className="p-2.5 w-14 text-center">N</th>
                      <th className="p-2.5 w-20 text-center">Min - Max</th>
                      <th className="p-2.5 w-20 text-center">Rerata</th>
                      <th className="p-2.5 w-24 text-center font-bold text-teal-800 dark:text-teal-300">Target (Median)</th>
                      <th className="p-2.5 w-16 text-center">IQR</th>
                      <th className="p-2.5 w-20 text-center font-bold text-blue-800 dark:text-blue-300">SDPA (nIQR)</th>
                      <th className="p-2.5 w-20 text-center">Robust SD</th>
                      <th className="p-2.5 w-16 text-center">CV %</th>
                      <th className="p-2.5 w-36 text-center">Rentang Tukey (Inner)</th>
                      <th className="p-2.5 min-w-[180px]">Uji Dixon Q-Test (N ≤ 25)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dashboardStats.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="p-2.5 text-center text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="p-2.5">
                          <p className="font-semibold text-foreground">{item.parameterName}</p>
                          <span className="text-[10px] text-muted-foreground font-mono">{item.unit || ""}</span>
                        </td>
                        <td className="p-2.5 text-center font-mono">{item.stats?.n || 0}</td>
                        <td className="p-2.5 text-center font-mono text-[11px]">
                          {item.stats ? `${item.stats.min.toFixed(2)} - ${item.stats.max.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-2.5 text-center font-mono">{item.stats ? item.stats.mean.toFixed(2) : "-"}</td>
                        <td className="p-2.5 text-center font-mono font-bold text-teal-700 dark:text-teal-400">
                          {item.stats ? item.stats.median.toFixed(2) : "-"}
                        </td>
                        <td className="p-2.5 text-center font-mono">{item.stats ? item.stats.iqr.toFixed(2) : "-"}</td>
                        <td className="p-2.5 text-center font-mono font-bold text-blue-700 dark:text-blue-400">
                          {item.stats ? item.stats.sdpa.toFixed(2) : "-"}
                        </td>
                        <td className="p-2.5 text-center font-mono">{item.stats ? item.stats.robustSd.toFixed(2) : "-"}</td>
                        <td className="p-2.5 text-center font-mono">{item.stats ? `${item.stats.cvPercent.toFixed(2)}%` : "-"}</td>
                        <td className="p-2.5 text-center font-mono text-[10px]">
                          {item.stats ? `${item.stats.innerLower.toFixed(2)} s.d ${item.stats.innerUpper.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-2.5 text-[11px]">
                          {item.dixon?.isApplicable ? (
                            <div className="space-y-0.5">
                              <span
                                className={`font-semibold ${
                                  item.dixon.isLowOutlier || item.dixon.isHighOutlier
                                    ? "text-red-600 font-bold"
                                    : "text-emerald-600"
                                }`}
                              >
                                {item.dixon.status}
                              </span>
                              <p className="text-[10px] text-muted-foreground">
                                Q-Tab: {item.dixon.qTable} | Q-Min: {item.dixon.qMin} | Q-Max: {item.dixon.qMax}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-[10px]">
                              {item.dixon?.status || "N > 25 (Gunakan ISO 13528)"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: REKAPITULASI LAPORAN HASIL PME (LENGKAP SEMUA PESERTA & PARAMETER) */}
        <TabsContent value="recap" className="space-y-6">
          {/* Top Control Bar & Export Buttons (No Print) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border bg-card shadow-xs no-print">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileBarChart className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-foreground">
                  Rekapitulasi Laporan Hasil PME
                </h3>
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400">
                  {filteredRecapData.length} Data Hasil Uji
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Rekap lengkap hasil pemeriksaan seluruh laboratorium peserta, nilai sasaran (target), SDPA, evaluasi Z-Score, instrumen, dan reagen.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportRecapExcel}
                disabled={isExportingRecapExcel || filteredRecapData.length === 0}
                className="text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-medium"
              >
                {isExportingRecapExcel ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                )}
                Export Excel (.xlsx)
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadRecapPdf}
                disabled={isExportingRecapPdf || filteredRecapData.length === 0}
                className="text-xs border-red-600 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 font-medium"
              >
                {isExportingRecapPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5 text-red-600" />
                )}
                Export PDF (.pdf)
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handlePrint}
                disabled={filteredRecapData.length === 0}
                className="text-xs border-slate-400 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 font-medium"
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Cetak / Print
              </Button>
            </div>
          </div>

          {/* Filter Bar Lengkap (No Print) */}
          <Card className="shadow-xs border no-print">
            <CardHeader className="p-4 pb-2 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-teal-600" />
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Filter Lengkap Rekapitulasi Data
                  </CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleResetRecapFilters}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset Filter
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              {/* Row 1: Siklus, Periode, Kategori, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Filter Siklus */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-blue-600" />
                    <span>Siklus PME</span>
                  </Label>
                  <Select
                    value={cycle}
                    onValueChange={(val) => {
                      setCycle(val);
                      loadReports(val);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue placeholder="Pilih Siklus" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCycles.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs font-medium">
                          {c}
                        </SelectItem>
                      ))}
                      {cycle && !availableCycles.includes(cycle) && (
                        <SelectItem value={cycle} className="text-xs font-medium">
                          {cycle}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Periode */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-amber-600" />
                    <span>Periode / Tahap</span>
                  </Label>
                  <Select value={recapPeriod} onValueChange={setRecapPeriod}>
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue placeholder="Semua Periode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs font-medium">
                        Semua Periode
                      </SelectItem>
                      {recapAvailablePeriods.map((p) => (
                        <SelectItem key={p} value={p} className="text-xs font-medium">
                          Periode {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Kategori Paket */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3 w-3 text-teal-600" />
                    <span>Kategori Paket</span>
                  </Label>
                  <Select value={recapCategory} onValueChange={setRecapCategory}>
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue placeholder="Semua Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs font-medium">
                        Semua Kategori
                      </SelectItem>
                      {recapAvailableCategories.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-xs font-medium">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Status Kinerja */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Award className="h-3 w-3 text-purple-600" />
                    <span>Status Evaluasi Mutu</span>
                  </Label>
                  <Select value={recapStatus} onValueChange={setRecapStatus}>
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue placeholder="Semua Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs font-medium">
                        Semua Status Kinerja
                      </SelectItem>
                      <SelectItem value="SATISFACTORY" className="text-xs font-medium text-emerald-600">
                        Memuaskan (|Z| ≤ 2.0)
                      </SelectItem>
                      <SelectItem value="WARNING" className="text-xs font-medium text-amber-600">
                        Peringatan (2.0 &lt; |Z| &lt; 3.0)
                      </SelectItem>
                      <SelectItem value="UNSATISFACTORY" className="text-xs font-medium text-red-600">
                        Tidak Memuaskan (|Z| ≥ 3.0)
                      </SelectItem>
                      <SelectItem value="NOT_EXAMINED" className="text-xs font-medium text-slate-500">
                        Parameter Tidak Diperiksa / Kosong
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Laboratorium, Parameter, Pencarian Cepat */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {/* Filter Laboratorium */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-indigo-600" />
                    <span>Laboratorium Peserta</span>
                  </Label>
                  <Select value={recapParticipant} onValueChange={setRecapParticipant}>
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue placeholder="Semua Laboratorium" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs font-medium">
                        Semua Laboratorium ({recapAvailableParticipants.length})
                      </SelectItem>
                      {recapAvailableParticipants.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs font-medium">
                          {p.name} {p.code && p.code !== "-" ? `(${p.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Parameter */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-emerald-600" />
                    <span>Parameter Pemeriksaan</span>
                  </Label>
                  <Select value={recapParameter} onValueChange={setRecapParameter}>
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue placeholder="Semua Parameter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs font-medium">
                        Semua Parameter ({recapAvailableParameters.length})
                      </SelectItem>
                      {recapAvailableParameters.map((param) => (
                        <SelectItem key={param} value={param} className="text-xs font-medium">
                          {param}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pencarian Cepat Teks */}
                <div className="space-y-1 lg:col-span-2">
                  <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Search className="h-3 w-3 text-slate-500" />
                    <span>Pencarian Cepat (Lab, Parameter, Metode, Alat, Reagen)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      value={recapSearch}
                      onChange={(e) => setRecapSearch(e.target.value)}
                      placeholder="Ketik kata kunci pencarian..."
                      className="h-8 text-xs pl-8 font-medium"
                    />
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    {recapSearch && (
                      <button
                        onClick={() => setRecapSearch("")}
                        className="absolute right-2.5 top-2 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Bersihkan
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Summary Cards (No Print) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
            <Card className="p-3 border shadow-xs bg-card">
              <p className="text-[11px] text-muted-foreground font-medium">Total Hasil Uji</p>
              <h4 className="text-lg font-bold mt-1 text-foreground">{recapStats.totalTests} Data</h4>
            </Card>
            <Card className="p-3 border shadow-xs bg-blue-50/50 dark:bg-blue-950/20 border-blue-500/20">
              <p className="text-[11px] text-blue-700 dark:text-blue-400 font-medium">Laboratorium</p>
              <h4 className="text-lg font-bold mt-1 text-blue-700 dark:text-blue-400">{recapStats.uniqueLabs} Lab</h4>
            </Card>
            <Card className="p-3 border shadow-xs bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/20">
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Memuaskan (|Z| ≤ 2)</p>
              <h4 className="text-lg font-bold mt-1 text-emerald-700 dark:text-emerald-400">{recapStats.satisfactory}</h4>
            </Card>
            <Card className="p-3 border shadow-xs bg-amber-50/50 dark:bg-amber-950/20 border-amber-500/20">
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Peringatan (2 &lt; |Z| &lt; 3)</p>
              <h4 className="text-lg font-bold mt-1 text-amber-700 dark:text-amber-400">{recapStats.warning}</h4>
            </Card>
            <Card className="p-3 border shadow-xs bg-red-50/50 dark:bg-red-950/20 border-red-500/20">
              <p className="text-[11px] text-red-700 dark:text-red-400 font-medium">Tdk Memuaskan (|Z| ≥ 3)</p>
              <h4 className="text-lg font-bold mt-1 text-red-700 dark:text-red-400">{recapStats.unsatisfactory}</h4>
            </Card>
            <Card className="p-3 border shadow-xs bg-purple-50/50 dark:bg-purple-950/20 border-purple-500/20">
              <p className="text-[11px] text-purple-700 dark:text-purple-400 font-medium">Tingkat Kelulusan</p>
              <h4 className="text-lg font-bold mt-1 text-purple-700 dark:text-purple-400">{recapStats.passRate}%</h4>
            </Card>
          </div>

          {/* Main Recap Document & Table Card (Printable Area) */}
          <div className="relative bg-white text-black p-6 sm:p-8 rounded-xl shadow-md border print:border-none print:shadow-none print:p-0 print:m-0 overflow-hidden">
            {/* Kop Surat Header (Resmi Kemenkes) */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-4">
              {/* Logo Kiri */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
                {kopSurat?.logoKiri ? (
                  <img
                    src={kopSurat.logoKiri}
                    alt="Logo Kiri"
                    className="max-h-16 max-w-16 sm:max-h-20 sm:max-w-20 object-contain"
                  />
                ) : (
                  <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-700 border border-teal-500/20">
                    <ShieldCheck className="h-8 w-8 sm:h-9 sm:w-9 text-teal-700" />
                  </div>
                )}
              </div>

              {/* Teks Tengah KOP Surat */}
              <div className="flex-1 text-center px-3 sm:px-4 space-y-0.5">
                <h2 className="text-xs sm:text-sm font-bold tracking-wider text-slate-800 uppercase">
                  {kopSurat?.pemda || "Kementerian Kesehatan Republik Indonesia"}
                </h2>
                <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 uppercase">
                  {kopSurat?.namaRumahSakit || "Balai Besar Laboratorium Kesehatan Masyarakat (Labkesmas Palembang I)"}
                </h1>
                <p className="text-[10px] sm:text-[11px] text-slate-600 font-normal leading-tight">
                  {kopSurat?.alamatRumahSakit || "Jl. Inspektur Yazid No.2, Sekip Jaya, Palembang, Sumatera Selatan"}
                </p>
                <p className="text-[9px] sm:text-[10px] text-slate-600 font-medium">
                  {kopSurat?.kontakRumahSakit || "Telp: (0711) 352 683 | Email: bblabkesmaspalembang@kemkes.go.id"}
                </p>
              </div>

              {/* Logo Kanan */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
                {kopSurat?.logoKanan ? (
                  <img
                    src={kopSurat.logoKanan}
                    alt="Logo Kanan"
                    className="max-h-16 max-w-16 sm:max-h-20 sm:max-w-20 object-contain"
                  />
                ) : (
                  <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-700 border border-blue-500/20">
                    <Award className="h-8 w-8 sm:h-9 sm:w-9 text-blue-700" />
                  </div>
                )}
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-4 space-y-1">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide">
                REKAPITULASI LAPORAN HASIL PROGRAM EVALUASI MUTU EKSTERNAL (PME)
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span><strong>Siklus:</strong> {cycle || "-"}</span>
                {recapPeriod !== "ALL" && <span>• <strong>Periode:</strong> {recapPeriod}</span>}
                {recapCategory !== "ALL" && <span>• <strong>Kategori:</strong> {recapCategory}</span>}
                <span>• <strong>Total Uji:</strong> {recapStats.totalTests} Data</span>
                <span>• <strong>Tingkat Kelulusan:</strong> {recapStats.passRate}%</span>
              </div>
            </div>

            {/* Tabel Data Rekapitulasi */}
            {filteredRecapData.length === 0 ? (
              <div className="p-10 text-center space-y-3 border-2 border-dashed rounded-lg my-4">
                <div className="p-3 bg-amber-500/10 text-amber-600 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">
                  Tidak Ada Data Rekapitulasi yang Sesuai
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Silakan periksa kembali kriteria filter yang Anda gunakan atau klik tombol Reset Filter di atas.
                </p>
                <Button size="sm" variant="outline" onClick={handleResetRecapFilters} className="text-xs">
                  <RotateCcw className="h-3 w-3 mr-1.5" />
                  Reset Filter
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto print:overflow-visible my-3 border rounded-lg">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-teal-700 text-white border-b border-teal-800 font-semibold text-center">
                      <th className="p-2 border border-teal-800 w-10">No</th>
                      <th className="p-2 border border-teal-800 w-24">Kode Lab</th>
                      <th className="p-2 border border-teal-800 min-w-[150px] text-left">Nama Laboratorium</th>
                      <th className="p-2 border border-teal-800 w-20">Siklus</th>
                      <th className="p-2 border border-teal-800 w-16">Periode</th>
                      <th className="p-2 border border-teal-800 w-24 text-left">Kategori</th>
                      <th className="p-2 border border-teal-800 min-w-[130px] text-left">Parameter</th>
                      <th className="p-2 border border-teal-800 w-16">Satuan</th>
                      <th className="p-2 border border-teal-800 w-20 text-right">Hasil Lab</th>
                      <th className="p-2 border border-teal-800 w-20 text-right">Target</th>
                      <th className="p-2 border border-teal-800 w-16 text-right">SDPA</th>
                      <th className="p-2 border border-teal-800 w-16">Z-Score</th>
                      <th className="p-2 border border-teal-800 min-w-[130px]">Status Kinerja</th>
                      <th className="p-2 border border-teal-800 min-w-[120px] text-left">Metode</th>
                      <th className="p-2 border border-teal-800 min-w-[120px] text-left">Alat</th>
                      <th className="p-2 border border-teal-800 min-w-[130px] text-left">Nama Reagen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredRecapData.map((d, idx) => {
                      const isUnsat = d.keterangan === "Tidak Memuaskan";
                      const isWarn = d.keterangan === "Peringatan";
                      const isSat = d.keterangan === "Memuaskan";

                      return (
                        <tr
                          key={`${d.submissionId}-${d.parameterName}-${idx}`}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                          } ${isUnsat ? "bg-red-50/30" : isWarn ? "bg-amber-50/20" : ""}`}
                        >
                          <td className="p-2 border border-slate-200 text-center font-mono text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="p-2 border border-slate-200 text-center font-mono font-semibold text-slate-800">
                            {d.participantCode}
                          </td>
                          <td className="p-2 border border-slate-200 font-medium text-slate-900">
                            {d.labName}
                          </td>
                          <td className="p-2 border border-slate-200 text-center text-slate-700">
                            {d.cycle}
                          </td>
                          <td className="p-2 border border-slate-200 text-center font-mono text-slate-700">
                            {d.period}
                          </td>
                          <td className="p-2 border border-slate-200 text-slate-700">
                            {d.category}
                          </td>
                          <td className="p-2 border border-slate-200 font-semibold text-slate-900">
                            {d.parameterName}
                          </td>
                          <td className="p-2 border border-slate-200 text-center font-mono text-slate-600">
                            {d.unit}
                          </td>
                          <td className="p-2 border border-slate-200 text-right font-mono font-bold text-slate-900">
                            {d.participantValue !== null ? d.participantValue : "-"}
                          </td>
                          <td className="p-2 border border-slate-200 text-right font-mono text-teal-800 font-semibold">
                            {d.target !== null ? d.target.toFixed(2) : "-"}
                          </td>
                          <td className="p-2 border border-slate-200 text-right font-mono text-blue-800">
                            {d.sdpa !== null ? d.sdpa.toFixed(2) : "-"}
                          </td>
                          <td className="p-2 border border-slate-200 text-center font-mono font-bold">
                            {d.zScore !== null ? (
                              <span
                                className={
                                  isSat
                                    ? "text-emerald-700"
                                    : isWarn
                                    ? "text-amber-700"
                                    : isUnsat
                                    ? "text-red-700"
                                    : "text-slate-500"
                                }
                              >
                                {d.zScore > 0 ? "+" : ""}
                                {d.zScore.toFixed(2)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="p-2 border border-slate-200 text-center">
                            {isSat ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold text-[10px]"
                              >
                                Memuaskan
                              </Badge>
                            ) : isWarn ? (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-700 border-amber-300 font-semibold text-[10px]"
                              >
                                Peringatan ($)
                              </Badge>
                            ) : isUnsat ? (
                              <Badge
                                variant="outline"
                                className="bg-red-50 text-red-700 border-red-300 font-semibold text-[10px]"
                              >
                                Tidak Memuaskan (Action)
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-slate-100 text-slate-500 border-slate-300 text-[10px]"
                              >
                                Tidak Diperiksa
                              </Badge>
                            )}
                          </td>
                          <td className="p-2 border border-slate-200 text-slate-700">
                            {d.methodCode}
                          </td>
                          <td className="p-2 border border-slate-200 text-slate-700">
                            {d.instrumentCode}
                          </td>
                          <td className="p-2 border border-slate-200 text-slate-700">
                            {d.reagentName}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Official Signer Footer Block */}
            <div className="pt-6 flex justify-end">
              <div className="w-72 text-right space-y-1 text-xs text-slate-800">
                <p>{signer.tempat || "Palembang"}, {signer.tanggal || "14 November 2027"}</p>
                <p className="font-medium text-slate-700">{signer.jabatan || "Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan"}</p>
                
                {/* Signature Cursive Sign */}
                <div className="py-4">
                  <p className="font-serif italic text-sm text-teal-800">
                    {signer.namaPejabat ? signer.namaPejabat.split(",")[0] : "Penyelenggara PME"}
                  </p>
                </div>

                {/* Nama Pejabat Lengkap */}
                <p className="font-bold underline text-slate-900">
                  {signer.namaPejabat || "M.Didik Wahyudi, S.Tr.Kes"}
                </p>
                <p className="text-[11px] text-slate-600 font-mono">
                  NIP. {signer.nip || "198408152009041001"}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL PENGATURAN PENANDATANGAN LAPORAN PME */}
      <Dialog open={isSignerModalOpen} onOpenChange={setIsSignerModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <PenLine className="h-5 w-5 text-teal-600" />
              <span>Pengaturan Penandatangan Laporan PME</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Atur data pejabat yang bertanda tangan pada lembar evaluasi resmi dan unduhan PDF laporan PME.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSigner} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nama Pejabat & Gelar</Label>
              <Input
                value={signerForm.namaPejabat}
                onChange={(e) => setSignerForm({ ...signerForm, namaPejabat: e.target.value })}
                placeholder="Contoh: M.Didik Wahyudi, S.Tr.Kes"
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Jabatan Pejabat</Label>
              <Input
                value={signerForm.jabatan}
                onChange={(e) => setSignerForm({ ...signerForm, jabatan: e.target.value })}
                placeholder="Contoh: Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan"
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tempat Pengesahan</Label>
                <Input
                  value={signerForm.tempat}
                  onChange={(e) => setSignerForm({ ...signerForm, tempat: e.target.value })}
                  placeholder="Contoh: OKU Timur"
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tanggal Pengesahan</Label>
                <Input
                  value={signerForm.tanggal}
                  onChange={(e) => setSignerForm({ ...signerForm, tanggal: e.target.value })}
                  placeholder="Contoh: 14 November 2027"
                  required
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">NIP Pejabat</Label>
              <Input
                value={signerForm.nip}
                onChange={(e) => setSignerForm({ ...signerForm, nip: e.target.value })}
                placeholder="Contoh: 198408152009041001"
                required
                className="h-9 text-xs font-mono"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsSignerModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={savingSigner} className="bg-teal-700 hover:bg-teal-800 text-white">
                {savingSigner ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                Simpan Penandatangan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL KONFIRMASI PENGIRIMAN LAPORAN KE PESERTA */}
      <Dialog open={isPublishModalOpen} onOpenChange={setIsPublishModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-teal-800">
              <Send className="h-5 w-5 text-teal-600" />
              <span>Kirim Laporan Hasil PME ke Peserta</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Laporan yang telah divalidasi akan dipublikasikan ke akun peserta sehingga peserta dapat langsung melihat dan mengunduh berkas PDF resmi di akun mereka.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-xs space-y-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Siklus PME:</span>
              <span className="font-semibold font-mono text-foreground">{cycle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target Peserta:</span>
              <span className="font-semibold text-foreground">
                {selectedParticipantId === "ALL" ? `Semua Peserta (${participantReports.length} Lab)` : activeReport?.participant.labName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Penandatangan:</span>
              <span className="font-semibold text-foreground">{signer.namaPejabat}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tanggal Pengesahan:</span>
              <span className="font-semibold text-foreground">{signer.tempat}, {signer.tanggal}</span>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsPublishModalOpen(false)}>
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={publishing}
              onClick={handlePublishReport}
              className="bg-teal-700 hover:bg-teal-800 text-white"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
              Kirim Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL PENGATURAN KOP SURAT (KHUSUS SUPERADMIN) */}
      <Dialog open={isKopSuratModalOpen} onOpenChange={setIsKopSuratModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border">
          <DialogHeader className="p-5 pb-3 border-b shrink-0 bg-background">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Building2 className="h-5 w-5 text-teal-600" />
              <span>Pengaturan KOP Surat Laporan Hasil PME</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Atur identitas instansi penyelenggara dan upload logo surat kanan & kiri. Logo disimpan otomatis di Google Drive tempat penyimpanan dokumen PME.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveKopSurat} className="flex flex-col flex-1 overflow-hidden">
            <div className="space-y-4 p-5 overflow-y-auto flex-1 overscroll-contain">
              {/* Kolom Upload Logo Kiri & Logo Kanan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Logo Kiri */}
                <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-teal-600" />
                      <span>Logo Surat Kiri</span>
                    </Label>
                    {kopSuratForm.logoKiri && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setKopSuratForm((prev) => ({ ...prev, logoKiri: null }))}
                        className="h-6 px-1.5 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Hapus
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 border rounded-md flex items-center justify-center bg-background shrink-0 overflow-hidden">
                      {kopSuratForm.logoKiri ? (
                        <img src={kopSuratForm.logoKiri} alt="Logo Kiri" className="h-full w-full object-contain p-1" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground text-center px-1">Kosong</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground h-8 px-3 rounded-md w-full border">
                        {uploadingLogoKiri ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Upload className="h-3.5 w-3.5 mr-1 text-teal-600" />
                        )}
                        <span>{uploadingLogoKiri ? "Mengunggah..." : "Pilih & Unggah Logo Kiri"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingLogoKiri}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleLogoUpload(f, "kiri");
                          }}
                        />
                      </label>
                      <p className="text-[10px] text-muted-foreground">Tersimpan di Google Drive PME</p>
                    </div>
                  </div>
                </div>

                {/* Logo Kanan */}
                <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
                      <span>Logo Surat Kanan</span>
                    </Label>
                    {kopSuratForm.logoKanan && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setKopSuratForm((prev) => ({ ...prev, logoKanan: null }))}
                        className="h-6 px-1.5 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Hapus
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 border rounded-md flex items-center justify-center bg-background shrink-0 overflow-hidden">
                      {kopSuratForm.logoKanan ? (
                        <img src={kopSuratForm.logoKanan} alt="Logo Kanan" className="h-full w-full object-contain p-1" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground text-center px-1">Kosong</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground h-8 px-3 rounded-md w-full border">
                        {uploadingLogoKanan ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Upload className="h-3.5 w-3.5 mr-1 text-blue-600" />
                        )}
                        <span>{uploadingLogoKanan ? "Mengunggah..." : "Pilih & Unggah Logo Kanan"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingLogoKanan}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleLogoUpload(f, "kanan");
                          }}
                        />
                      </label>
                      <p className="text-[10px] text-muted-foreground">Tersimpan di Google Drive PME</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Kolom Identitas KOP Surat */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Dinas / Kementerian / Lembaga</Label>
                  <Input
                    value={kopSuratForm.pemda}
                    onChange={(e) => setKopSuratForm((prev) => ({ ...prev, pemda: e.target.value }))}
                    placeholder="Contoh: Kementerian Kesehatan Republik Indonesia"
                    className="h-8 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Penyelenggara PME</Label>
                  <Input
                    value={kopSuratForm.namaRumahSakit}
                    onChange={(e) => setKopSuratForm((prev) => ({ ...prev, namaRumahSakit: e.target.value }))}
                    placeholder="Contoh: Balai Besar Laboratorium Kesehatan Masyarakat (Labkesmas Palembang I)"
                    className="h-8 text-xs font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Alamat Lengkap</Label>
                  <Input
                    value={kopSuratForm.alamatRumahSakit}
                    onChange={(e) => setKopSuratForm((prev) => ({ ...prev, alamatRumahSakit: e.target.value }))}
                    placeholder="Contoh: Jl. Inspektur Yazid No.2, Sekip Jaya, Palembang, Sumatera Selatan"
                    className="h-8 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Telepon & Email Resmi</Label>
                  <Input
                    value={kopSuratForm.kontakRumahSakit}
                    onChange={(e) => setKopSuratForm((prev) => ({ ...prev, kontakRumahSakit: e.target.value }))}
                    placeholder="Contoh: Telp: (0711) 352 683 | Email: bblabkesmaspalembang@kemkes.go.id"
                    className="h-8 text-xs"
                    required
                  />
                </div>
              </div>

              {/* Live Preview KOP Surat */}
              <div className="pt-2 border-t">
                <Label className="text-xs font-bold text-muted-foreground block mb-2">Pratinjau KOP Surat:</Label>
                <div className="p-4 bg-white text-black border rounded-lg shadow-xs">
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2.5">
                    <div className="w-14 h-14 flex items-center justify-center shrink-0">
                      {kopSuratForm.logoKiri ? (
                        <img src={kopSuratForm.logoKiri} alt="Logo Kiri" className="max-h-14 max-w-14 object-contain" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700 border border-teal-200">
                          <ShieldCheck className="h-7 w-7 text-teal-700" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-center px-3 space-y-0.5">
                      <p className="text-[10px] font-bold text-slate-800 uppercase tracking-wide">
                        {kopSuratForm.pemda || "DINAS / KEMENTERIAN / LEMBAGA"}
                      </p>
                      <p className="text-xs font-extrabold text-slate-900 uppercase">
                        {kopSuratForm.namaRumahSakit || "PENYELENGGARA PME"}
                      </p>
                      <p className="text-[9px] text-slate-600 font-normal leading-tight">
                        {kopSuratForm.alamatRumahSakit || "Alamat Lengkap Penyelenggara"}
                      </p>
                      <p className="text-[9px] text-slate-600 font-medium">
                        {kopSuratForm.kontakRumahSakit || "Telepon & Email Resmi"}
                      </p>
                    </div>
                    <div className="w-14 h-14 flex items-center justify-center shrink-0">
                      {kopSuratForm.logoKanan ? (
                        <img src={kopSuratForm.logoKanan} alt="Logo Kanan" className="max-h-14 max-w-14 object-contain" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-dashed">
                          <Award className="h-6 w-6 text-slate-400" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 border-t bg-muted/20 shrink-0 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsKopSuratModalOpen(false)}>
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingKopSurat || uploadingLogoKiri || uploadingLogoKanan}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                {savingKopSurat ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                Simpan Pengaturan KOP Surat
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL KONFIRMASI PENARIKAN / PEMBATALAN LAPORAN (SUPERADMIN) */}
      <Dialog open={isRetractModalOpen} onOpenChange={setIsRetractModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-amber-600">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              <span>Tarik Kembali / Batalkan Laporan</span>
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed pt-1">
              Apakah Anda yakin ingin menarik kembali laporan hasil PME? Setelah ditarik, tampilan menu laporan hasil pada akun peserta terkait akan <strong>kembali kosong</strong> hingga Anda memvalidasi dan mengirimkannya kembali.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-xs space-y-2 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Siklus PME:</span>
              <span className="font-semibold font-mono text-foreground">{cycle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target Penarikan:</span>
              <span className="font-bold text-amber-700 dark:text-amber-400">
                {selectedParticipantId === "ALL"
                  ? `Semua Peserta (${participantReports.length} Lab)`
                  : activeReport?.participant.labName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dampak ke Peserta:</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                Menu laporan peserta kembali kosong
              </span>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsRetractModalOpen(false)}>
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={retracting}
              onClick={handleRetractReport}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {retracting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
              Tarik Laporan Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
