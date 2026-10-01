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
  ShieldAlert,
  Target,
  FileText,
  CheckCircle,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface EvaluationRow {
  no: number;
  parameterName: string;
  unit: string;
  sample?: string;
  sampleLabel?: string;
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
  sample?: string;
  sampleLabel?: string;
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
  const isReadOnly = user?.role === "ADMIN2";

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
  const [selectedSample, setSelectedSample] = useState<string>("Sampel 1"); // "ALL" | "Sampel 1" | "Sampel 2"

  // Kuota Analisis Hasil PME (Dikelola oleh Superadmin pada menu Pengaturan)
  const [quotaInfo, setQuotaInfo] = useState<{
    used: number;
    limit: number;
    remaining: number;
    usagePct: number;
    canAnalyze: boolean;
  } | null>(null);
  const [analyzingPme, setAnalyzingPme] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isQuotaExhaustedModalOpen, setIsQuotaExhaustedModalOpen] = useState(false);
  const [isAnalysisSetupOpen, setIsAnalysisSetupOpen] = useState(false);
  const [analysisSampleTarget, setAnalysisSampleTarget] = useState<string>("Sampel 1");

  const [kopSurat, setKopSurat] = useState<any>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);
  const [participantNotice, setParticipantNotice] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [activeTab, setActiveTab] = useState<string>("report");

  // State Filter & Status Rekapitulasi Laporan Hasil PME
  const [recapPeriod, setRecapPeriod] = useState<string>("ALL");
  const [recapCategory, setRecapCategory] = useState<string>("ALL");
  const [recapSample, setRecapSample] = useState<string>("ALL");
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

  const loadQuota = async () => {
    try {
      const res = await fetch("/api/pme-mgmt/reports/analyze", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        if (data.quota) {
          setQuotaInfo(data.quota);
        }
      }
    } catch (err) {
      console.error("Gagal memuat kuota analisis:", err);
    }
  };

  useEffect(() => {
    loadQuota();
  }, [viewAsTenantId]);

  const handleOpenPmeAnalysis = () => {
    if (quotaInfo && quotaInfo.remaining <= 0) {
      setIsQuotaExhaustedModalOpen(true);
      return;
    }
    if (selectedSample === "Sampel 2") {
      setAnalysisSampleTarget("Sampel 2");
    } else {
      setAnalysisSampleTarget("Sampel 1");
    }
    setIsAnalysisSetupOpen(true);
  };

  const handleRunPmeAnalysis = async (targetSample?: string) => {
    const sampleToAnalyze = targetSample || analysisSampleTarget;
    if (quotaInfo && quotaInfo.remaining <= 0) {
      setIsAnalysisSetupOpen(false);
      setIsQuotaExhaustedModalOpen(true);
      return;
    }

    setAnalyzingPme(true);
    try {
      const res = await fetch("/api/pme-mgmt/reports/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          cycle,
          sample: sampleToAnalyze,
          participantId: selectedParticipantId !== "ALL" ? selectedParticipantId : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAnalysisResult(data.analysis);
        if (data.quota) {
          setQuotaInfo(data.quota);
        }
        setIsAnalysisSetupOpen(false);
        setIsAnalysisModalOpen(true);
        toast({
          title: "Analisis Hasil PME Berhasil",
          description: data.message || `Analisis mutu ${sampleToAnalyze} berhasil disusun.`,
        });
      } else {
        if (res.status === 429 || data.code === "QUOTA_EXCEEDED") {
          if (data.quota) setQuotaInfo(data.quota);
          setIsAnalysisSetupOpen(false);
          setIsQuotaExhaustedModalOpen(true);
        } else {
          toast({
            title: "Gagal Menjalankan Analisis",
            description: data.error || "Terjadi kesalahan saat memproses analisis.",
            variant: "destructive",
          });
        }
      }
    } catch {
      toast({
        title: "Kesalahan Jaringan",
        description: "Gagal memproses analisis hasil PME.",
        variant: "destructive",
      });
    } finally {
      setAnalyzingPme(false);
    }
  };

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
      sample: string;
      sampleLabel: string;
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
          sample: pr.sample || r.sample || "Sampel 1",
          sampleLabel: pr.sampleLabel || r.sampleLabel || (r.sample === "Sampel 2" ? "Sampel 2 (Level 2)" : "Sampel 1 (Level 1)"),
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
      if (recapSample !== "ALL" && item.sample !== recapSample) return false;
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
          item.reagentName.toLowerCase().includes(q) ||
          item.sampleLabel.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [flattenedRecapData, recapPeriod, recapCategory, recapSample, recapParticipant, recapParameter, recapStatus, recapSearch]);

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
    setRecapSample("ALL");
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
      ws1.mergeCells("A1:Q1");
      const titleCell = ws1.getCell("A1");
      titleCell.value = (kopSurat?.pemda || "KEMENTERIAN KESEHATAN REPUBLIK INDONESIA").toUpperCase();
      titleCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF334155" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };

      ws1.mergeCells("A2:Q2");
      const instansiCell = ws1.getCell("A2");
      instansiCell.value = (kopSurat?.namaRumahSakit || "BALAI BESAR LABORATORIUM KESEHATAN MASYARAKAT PALEMBANG").toUpperCase();
      instansiCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF0F172A" } };
      instansiCell.alignment = { horizontal: "center", vertical: "middle" };

      ws1.mergeCells("A3:Q3");
      const subTitleCell = ws1.getCell("A3");
      subTitleCell.value = `REKAPITULASI LAPORAN HASIL PROGRAM EVALUASI MUTU EKSTERNAL (PME) - SIKLUS: ${cycle.toUpperCase()}`;
      subTitleCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF047857" } };
      subTitleCell.alignment = { horizontal: "center", vertical: "middle" };

      ws1.mergeCells("A4:Q4");
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
        "Sampel / Level",
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
          item.sampleLabel || item.sample,
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

          if ([1, 2, 4, 5, 6, 9, 13, 15, 16].includes(colNumber)) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else if ([10, 11, 12].includes(colNumber)) {
            cell.alignment = { horizontal: "right", vertical: "middle" };
          } else if (colNumber === 14) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }

          if (idx % 2 === 1 && colNumber !== 14) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" },
            };
          }
        });

        const statusCell = row.getCell(14);
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
        { width: 18 },
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
      const sigCol = 14;
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
          "Sampel",
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
        d.sampleLabel || d.sample,
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
          2: { cellWidth: 34 },
          3: { cellWidth: 18, halign: "center" },
          4: { cellWidth: 16 },
          5: { cellWidth: 24 },
          6: { cellWidth: 10, halign: "center" },
          7: { cellWidth: 13, halign: "right" },
          8: { cellWidth: 13, halign: "right" },
          9: { cellWidth: 12, halign: "right" },
          10: { cellWidth: 12, halign: "center" },
          11: { cellWidth: 18, halign: "center" },
          12: { cellWidth: 24 },
          13: { cellWidth: 24 },
          14: { cellWidth: 32 },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 11) {
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
      const titleText = `HASIL EVALUASI BIDANG PATOLOGI PARAMETER ${category === "ALL" ? "SEMUA BIDANG" : category.toUpperCase()} ${(report.cycle || cycle).toUpperCase()}${report.sampleLabel ? ` - ${report.sampleLabel.toUpperCase()}` : ""}`;
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

      y += 4.5;
      doc.setFont("helvetica", "bold");
      doc.text("Level / Sampel", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${report.sampleLabel || report.sample || "Sampel 1 (Level 1)"}`, margin + 25, y);

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

      doc.save(`Laporan_PME_${report.participant.labName.replace(/\s+/g, "_")}_${(report.sample || "Sampel_1").replace(/\s+/g, "_")}_${cycle.replace(/\s+/g, "_")}.pdf`);
      toast({ title: "PDF Berhasil Diunduh", description: "Format lembar evaluasi resmi Kemenkes telah tersimpan." });
    } catch (err) {
      toast({ title: "Gagal membuat PDF", description: String(err), variant: "destructive" });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const displayedReports = useMemo(() => {
    if (selectedSample === "ALL") return participantReports;
    return participantReports.filter((r) => (r.sample || "Sampel 1") === selectedSample);
  }, [participantReports, selectedSample]);

  const activeReport = displayedReports.length > 0 ? displayedReports[0] : (participantReports.length > 0 ? participantReports[0] : null);

  // Dynamic Tenant Display Name (Berubah dinamis sesuai akun login tenant / peserta aktif)
  const tenantDisplayName = useMemo(() => {
    if (viewAsTenantId && viewAsTenantId !== "ALL") {
      const matched = participantReports.find((p) => p.participant.id === viewAsTenantId);
      if (matched) return matched.participant.labName;
    }
    if (activeReport?.participant?.labName && !isSuperAdmin) {
      return activeReport.participant.labName;
    }
    if (user?.organization?.name) {
      return user.organization.name;
    }
    if (user?.role === "SUPERADMIN") {
      return "Superadmin";
    }
    return user?.name || "Laboratorium Peserta";
  }, [viewAsTenantId, participantReports, activeReport, user, isSuperAdmin]);

  // Generate PDF Laporan Hasil Analisis (Format Model 1 Resmi Kemenkes Lengkap Fishbone 6M)
  const handleDownloadAnalysisPdf = (dataInput?: any) => {
    const data = dataInput || analysisResult;
    if (!data) {
      toast({
        title: "Data Analisis Belum Tersedia",
        description: "Silakan klik tombol 'Analisa Hasil PME' terlebih dahulu untuk menjalankan analisis mutu dan evaluasi ISO 15189.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsExportingPdf(true);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;

      // Scoped Participant Data (Strict multi-tenant scoping)
      const targetLab = (isSuperAdmin || isReadOnly)
        ? (activeReport?.participant?.labName || data.participantName || tenantDisplayName)
        : (user?.organization?.name || user?.name || data.participantName || "Laboratorium Peserta");
      const targetCode = (isSuperAdmin || isReadOnly)
        ? (activeReport?.participant?.participantCode || data.participantCode || "-")
        : (data.participantCode || "-");
      const targetAddress = activeReport?.participant?.address || "Sumatera Selatan";
      const sampleTitle = (data.sampleLabel || selectedSample || "Sampel 1").toUpperCase();

      const drawKopSuratAndHeader = () => {
        let y = 10;
        const logoSize = 18;

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

        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(0.6);
        doc.line(margin, y + 20, pageW - margin, y + 20);
        doc.setLineWidth(0.2);
        doc.line(margin, y + 20.8, pageW - margin, y + 20.8);
      };

      const drawWatermark = () => {
        doc.saveGraphicsState();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(70);
        doc.setTextColor(239, 68, 68);
        // @ts-ignore
        if (doc.setGState) {
          // @ts-ignore
          doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
        }
        doc.text("RAHASIA", pageW / 2, pageH / 2, {
          align: "center",
          angle: 30,
        });
        doc.restoreGraphicsState();
      };

      // Page 1 Header
      drawKopSuratAndHeader();
      drawWatermark();

      let y = 37;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `LAPORAN HASIL EVALUASI & ANALISIS MUTU PME (ISO 15189) - ${sampleTitle}`,
        pageW / 2,
        y,
        { align: "center" }
      );

      // Metadata Peserta
      y += 6;
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text("Kode Peserta", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${targetCode}`, margin + 28, y);

      doc.setFont("helvetica", "bold");
      doc.text("Bidang / Siklus", pageW / 2 + 10, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${category === "ALL" ? "Semua Bidang" : category} / ${data.cycle || cycle}`, pageW / 2 + 40, y);

      y += 4.5;
      doc.setFont("helvetica", "bold");
      doc.text("Nama Laboratorium", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${targetLab}`, margin + 28, y);

      doc.setFont("helvetica", "bold");
      doc.text("Level / Sampel", pageW / 2 + 10, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${data.sampleLabel || selectedSample}`, pageW / 2 + 40, y);

      y += 4.5;
      doc.setFont("helvetica", "bold");
      doc.text("Alamat Peserta", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${targetAddress}`, margin + 28, y);

      doc.setFont("helvetica", "bold");
      doc.text("Status Evaluasi", pageW / 2 + 10, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: Pass Rate ${data.passRate}% (${data.satisfactoryCount} Memuaskan, ${data.warningCount} Peringatan, ${data.unsatisfactoryCount} Tidak Memuaskan)`, pageW / 2 + 40, y);

      // Table 1: Rincian Evaluasi Hasil Pengujian per Parameter
      const findingsHead = [
        ["No", "Parameter", "Satuan", "Hasil Lab", "Target Konsensus", "SDPA", "Bias %", "Z-Score", "Kategori & Status"]
      ];

      const findingsBody = (data.evaluationFindings || []).map((f: any, idx: number) => [
        idx + 1,
        f.parameterName,
        f.unit || "-",
        f.value !== null && f.value !== undefined ? Number(f.value).toFixed(2) : "-",
        f.target !== null && f.target !== undefined ? Number(f.target).toFixed(2) : "-",
        f.sdpa !== null && f.sdpa !== undefined ? Number(f.sdpa).toFixed(2) : "-",
        f.biasPercent !== null && f.biasPercent !== undefined ? (f.biasPercent > 0 ? `+${f.biasPercent}%` : `${f.biasPercent}%`) : "-",
        f.zScore !== null && f.zScore !== undefined ? (f.zScore > 0 ? `+${Number(f.zScore).toFixed(2)}` : Number(f.zScore).toFixed(2)) : "-",
        f.statusText || "-"
      ]);

      autoTable(doc, {
        startY: y + 4,
        head: findingsHead,
        body: findingsBody,
        theme: "grid",
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
          valign: "middle",
          halign: "center",
          textColor: [30, 41, 59],
          lineColor: [203, 213, 225],
          lineWidth: 0.15,
        },
        headStyles: {
          fillColor: [15, 118, 110],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 42, halign: "left", fontStyle: "bold" },
          2: { cellWidth: 16, halign: "center" },
          3: { cellWidth: 20, halign: "right", fontStyle: "bold" },
          4: { cellWidth: 24, halign: "right" },
          5: { cellWidth: 20, halign: "right" },
          6: { cellWidth: 20, halign: "center" },
          7: { cellWidth: 20, halign: "center", fontStyle: "bold" },
          8: { cellWidth: 35, halign: "center" },
        },
      });

      // @ts-ignore
      let currentY = (doc as any).lastAutoTable?.finalY + 5 || 100;

      // Table 2: Matriks Investigasi Akar Masalah 6M (Fishbone Ishikawa)
      if (currentY > pageH - 75) {
        doc.addPage("a4", "landscape");
        drawKopSuratAndHeader();
        drawWatermark();
        currentY = 38;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text("MATRIKS INVESTIGASI AKAR MASALAH (FISHBONE ISHIKAWA 6M):", margin, currentY);

      const fishboneHead = [
        ["No", "Kategori 6M", "Temuan & Analisa Akar Masalah (Root Cause Finding)", "Rekomendasi Tindakan Korektif & Preventif"]
      ];

      const fishboneBody = (data.fishbone || []).map((fb: any, idx: number) => [
        idx + 1,
        fb.category,
        fb.finding,
        fb.action
      ]);

      autoTable(doc, {
        startY: currentY + 2.5,
        head: fishboneHead,
        body: fishboneBody,
        theme: "grid",
        styles: {
          fontSize: 7,
          cellPadding: 1.8,
          valign: "top",
          textColor: [30, 41, 59],
          lineColor: [203, 213, 225],
          lineWidth: 0.15,
        },
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 35, fontStyle: "bold", halign: "left" },
          2: { cellWidth: 95, halign: "left" },
          3: { cellWidth: 95, halign: "left" },
        },
      });

      // @ts-ignore
      currentY = (doc as any).lastAutoTable?.finalY + 5 || 150;

      // CAPA & Signer Section
      if (currentY > pageH - 55) {
        doc.addPage("a4", "landscape");
        drawKopSuratAndHeader();
        drawWatermark();
        currentY = 38;
      }

      // CAPA Left Box
      const capaW = pageW / 2 - margin - 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(185, 28, 28);
      doc.text("TINDAKAN KOREKTIF SEGERA (CORRECTIVE ACTIONS):", margin, currentY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(51, 65, 85);
      let capY = currentY + 3.5;
      (data.correctiveActions || []).slice(0, 3).forEach((ca: string) => {
        const lines = doc.splitTextToSize(`• ${ca}`, capaW);
        doc.text(lines, margin, capY);
        capY += lines.length * 3.2;
      });

      capY += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(16, 122, 87);
      doc.text("TINDAKAN PENCEGAHAN BERKELANJUTAN (PREVENTIVE ACTIONS):", margin, capY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(51, 65, 85);
      capY += 3.5;
      (data.preventiveActions || []).slice(0, 3).forEach((pa: string) => {
        const lines = doc.splitTextToSize(`• ${pa}`, capaW);
        doc.text(lines, margin, capY);
        capY += lines.length * 3.2;
      });

      // Signer Right Box
      const sigBlockW = 75;
      const sigX = pageW - margin - sigBlockW;
      let sigY = currentY;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`${signer.tempat || "OKU Timur"}, ${signer.tanggal || "14 November 2027"}`, sigX, sigY);
      sigY += 3.5;
      const splitJabatan = doc.splitTextToSize(signer.jabatan || "Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan", sigBlockW);
      doc.text(splitJabatan, sigX, sigY);
      sigY += (splitJabatan.length * 3.5) + 6;

      // Cursive Signature
      doc.setFont("times", "italic");
      doc.setFontSize(10.5);
      doc.setTextColor(15, 118, 110);
      const cursiveName = signer.namaPejabat ? signer.namaPejabat.split(",")[0] : "M.Didik Wahyudi";
      doc.text(cursiveName, sigX, sigY);
      sigY += 4.5;

      // Official Name & Underline
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      const namaLengkap = signer.namaPejabat || "M.Didik Wahyudi, S.Tr.Kes";
      doc.text(namaLengkap, sigX, sigY);
      const nameW = doc.getTextWidth(namaLengkap);
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.2);
      doc.line(sigX, sigY + 0.6, sigX + nameW, sigY + 0.6);
      sigY += 3.5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`NIP ${signer.nip || "198408152009041001"}`, sigX, sigY);

      // Footer note
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `* Laporan Analisis Mutu & Fishbone ISO 15189 diterbitkan resmi dan bersifat RAHASIA untuk ${targetLab}.`,
        margin,
        pageH - 5
      );

      const safeFilename = `Laporan_Analisis_PME_Model1_${targetLab.replace(/\s+/g, "_")}_${(data.sampleLabel || selectedSample).replace(/\s+/g, "_")}.pdf`;
      doc.save(safeFilename);
      toast({
        title: "PDF Analisis Berhasil Diunduh",
        description: `Format evaluasi Model 1 lengkap dengan Fishbone 6M (${safeFilename}) tersimpan.`,
      });
    } catch (err) {
      console.error("Download Analysis PDF error:", err);
      toast({
        title: "Gagal Mengunduh PDF Analisis",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Cetak Laporan Hasil Analisis (Format Model 1 Resmi Lengkap Fishbone 6M)
  const handlePrintAnalysis = (dataInput?: any) => {
    const data = dataInput || analysisResult;
    if (!data) {
      toast({
        title: "Data Analisis Belum Tersedia",
        description: "Silakan klik tombol 'Analisa Hasil PME' terlebih dahulu sebelum mencetak lembar evaluasi.",
        variant: "destructive",
      });
      return;
    }

    const targetLab = (isSuperAdmin || isReadOnly)
      ? (activeReport?.participant?.labName || data.participantName || tenantDisplayName)
      : (user?.organization?.name || user?.name || data.participantName || "Laboratorium Peserta");
    const targetCode = (isSuperAdmin || isReadOnly)
      ? (activeReport?.participant?.participantCode || data.participantCode || "-")
      : (data.participantCode || "-");
    const targetAddress = activeReport?.participant?.address || "Sumatera Selatan";
    const sampleTitle = (data.sampleLabel || selectedSample || "Sampel 1").toUpperCase();

    const printWindow = window.open("", "_blank", "width=1150,height=850");
    if (!printWindow) {
      toast({
        title: "Popup Diblokir Browser",
        description: "Mohon izinkan popup di peramban Anda untuk mencetak lembar evaluasi Model 1.",
        variant: "destructive",
      });
      return;
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Laporan Hasil Evaluasi & Analisis Mutu PME (Model 1) - ${targetLab}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 10px;
      font-size: 10.5px;
      line-height: 1.35;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-size: 110px;
      font-weight: 900;
      color: rgba(239, 68, 68, 0.06);
      text-transform: uppercase;
      letter-spacing: 12px;
      pointer-events: none;
      z-index: 0;
    }
    .content-wrap {
      position: relative;
      z-index: 1;
    }
    .kop-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .kop-logo {
      width: 70px;
      height: 70px;
      object-fit: contain;
    }
    .kop-text {
      flex: 1;
      text-align: center;
      padding: 0 16px;
    }
    .kop-text h3 {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .kop-text h2 {
      margin: 2px 0;
      font-size: 14px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
    }
    .kop-text p {
      margin: 1px 0;
      font-size: 9.5px;
      color: #475569;
    }
    .doc-title {
      text-align: center;
      margin: 10px 0 8px 0;
    }
    .doc-title h1 {
      margin: 0;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    .doc-title .badge {
      display: inline-block;
      margin-top: 4px;
      padding: 3px 12px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 700;
      background: #ccfbf1;
      color: #0f766e;
      border: 1px solid #5eead4;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 10px;
      font-size: 9.5px;
    }
    .meta-row {
      display: flex;
      gap: 6px;
      line-height: 1.4;
    }
    .meta-label {
      width: 120px;
      font-weight: 700;
      color: #475569;
    }
    .meta-val {
      font-weight: 600;
      color: #0f172a;
    }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }
    .kpi-box {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 8px;
      background: #ffffff;
      text-align: center;
    }
    .kpi-box.green { background: #f0fdf4; border-color: #86efac; color: #166534; }
    .kpi-box.amber { background: #fffbeb; border-color: #fde68a; color: #92400e; }
    .kpi-box.red { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
    .kpi-box.teal { background: #f0fdfa; border-color: #99f6e4; color: #0f766e; }
    .kpi-title { font-size: 9px; font-weight: 600; text-transform: uppercase; margin-bottom: 2px; }
    .kpi-val { font-size: 15px; font-weight: 800; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 9.5px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 4px 6px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 700;
      color: #0f172a;
      text-align: center;
    }
    .th-teal { background: #0f766e; color: #ffffff; }
    .th-indigo { background: #1e3a8a; color: #ffffff; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .badge-sat { background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 8.5px; }
    .badge-warn { background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 8.5px; }
    .badge-unsat { background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 8.5px; }
    .section-title {
      font-size: 10.5px;
      font-weight: 800;
      color: #0f172a;
      margin: 8px 0 4px 0;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .capa-sig-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 14px;
      margin-top: 8px;
      page-break-inside: avoid;
    }
    .capa-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 10px;
      background: #f8fafc;
      font-size: 9px;
    }
    .capa-box h4 {
      margin: 0 0 4px 0;
      font-size: 9.5px;
      font-weight: 800;
    }
    .capa-box ul {
      margin: 0;
      padding-left: 14px;
    }
    .capa-box li {
      margin-bottom: 3px;
      line-height: 1.3;
    }
    .signer-box {
      text-align: right;
      padding-right: 15px;
      font-size: 9.5px;
    }
    .signer-sig {
      font-family: Georgia, serif;
      font-style: italic;
      font-size: 15px;
      color: #0f766e;
      margin: 10px 0 4px 0;
      font-weight: 700;
    }
    .signer-name {
      font-weight: 800;
      color: #0f172a;
      text-decoration: underline;
    }
    .footer-note {
      margin-top: 10px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 4px;
      font-size: 8.5px;
      color: #64748b;
      font-style: italic;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="watermark">RAHASIA</div>
  <div class="content-wrap">
    <!-- KOP SURAT -->
    <div class="kop-header">
      <div>
        ${kopSurat?.logoKiri ? `<img src="${kopSurat.logoKiri}" class="kop-logo" alt="Logo" />` : '<div style="width:60px;height:60px;border:1px dashed #94a3b8;display:flex;align-items:center;justify-content:center;font-size:9px;">LOGO</div>'}
      </div>
      <div class="kop-text">
        <h3>${(kopSurat?.pemda || "Kementerian Kesehatan Republik Indonesia").toUpperCase()}</h3>
        <h2>${(kopSurat?.namaRumahSakit || "Balai Besar Laboratorium Kesehatan Masyarakat Palembang").toUpperCase()}</h2>
        <p>${kopSurat?.alamatRumahSakit || "Jl. Inspektur Yazid No.2, Sekip Jaya, Palembang, Sumatera Selatan"}</p>
        <p>${kopSurat?.kontakRumahSakit || "Telp: (0711) 352 683 | Email: bblabkesmaspalembang@kemkes.go.id"}</p>
      </div>
      <div>
        ${kopSurat?.logoKanan ? `<img src="${kopSurat.logoKanan}" class="kop-logo" alt="Logo" />` : '<div style="width:60px;height:60px;border:1px dashed #94a3b8;display:flex;align-items:center;justify-content:center;font-size:9px;">LOGO</div>'}
      </div>
    </div>

    <!-- TITLE -->
    <div class="doc-title">
      <h1>LAPORAN HASIL EVALUASI & ANALISIS MUTU PME (ISO 15189)</h1>
      <span class="badge">🧪 BIDANG ${(category === "ALL" ? "SEMUA BIDANG" : category).toUpperCase()} • ${sampleTitle}</span>
    </div>

    <!-- METADATA -->
    <div class="meta-grid">
      <div>
        <div class="meta-row"><span class="meta-label">Kode Peserta</span><span class="meta-val">: ${targetCode}</span></div>
        <div class="meta-row"><span class="meta-label">Nama Laboratorium</span><span class="meta-val">: ${targetLab}</span></div>
        <div class="meta-row"><span class="meta-label">Alamat Peserta</span><span class="meta-val">: ${targetAddress}</span></div>
      </div>
      <div>
        <div class="meta-row"><span class="meta-label">Siklus PME</span><span class="meta-val">: ${data.cycle || cycle}</span></div>
        <div class="meta-row"><span class="meta-label">Level / Botol</span><span class="meta-val">: ${data.sampleLabel || selectedSample}</span></div>
        <div class="meta-row"><span class="meta-label">Tanggal Analisis</span><span class="meta-val">: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span></div>
      </div>
    </div>

    <!-- KPI -->
    <div class="kpi-row">
      <div class="kpi-box">
        <div class="kpi-title">Parameter Diuji</div>
        <div class="kpi-val">${data.totalParameters}</div>
      </div>
      <div class="kpi-box green">
        <div class="kpi-title">Memuaskan (|Z| ≤ 2)</div>
        <div class="kpi-val">${data.satisfactoryCount}</div>
      </div>
      <div class="kpi-box amber">
        <div class="kpi-title">Peringatan (2 &lt; |Z| &lt; 3)</div>
        <div class="kpi-val">${data.warningCount}</div>
      </div>
      <div class="kpi-box red">
        <div class="kpi-title">Tdk Memuaskan (|Z| ≥ 3)</div>
        <div class="kpi-val">${data.unsatisfactoryCount}</div>
      </div>
      <div class="kpi-box teal">
        <div class="kpi-title">Pass Rate</div>
        <div class="kpi-val">${data.passRate}%</div>
      </div>
    </div>

    <!-- TABEL EVALUASI BIOSTATISTIK -->
    <div class="section-title">1. Rincian Evaluasi Hasil Pengujian per Parameter (ISO 13528)</div>
    <table>
      <thead>
        <tr class="th-teal">
          <th style="width: 25px;">No</th>
          <th>Parameter</th>
          <th style="width: 55px;">Satuan</th>
          <th style="width: 70px;">Hasil Lab</th>
          <th style="width: 80px;">Target Konsensus</th>
          <th style="width: 65px;">SDPA</th>
          <th style="width: 65px;">Bias %</th>
          <th style="width: 65px;">Z-Score</th>
          <th style="width: 100px;">Status Evaluasi</th>
        </tr>
      </thead>
      <tbody>
        ${(data.evaluationFindings || []).map((f: any, idx: number) => `
          <tr style="${f.statusText === 'Tidak Memuaskan' ? 'background:#fef2f2;' : f.statusText === 'Peringatan' ? 'background:#fffbeb;' : ''}">
            <td class="text-center">${idx + 1}</td>
            <td><strong>${f.parameterName}</strong></td>
            <td class="text-center">${f.unit || '-'}</td>
            <td class="text-right"><strong>${f.value !== null && f.value !== undefined ? Number(f.value).toFixed(2) : '-'}</strong></td>
            <td class="text-right">${f.target !== null && f.target !== undefined ? Number(f.target).toFixed(2) : '-'}</td>
            <td class="text-right">${f.sdpa !== null && f.sdpa !== undefined ? Number(f.sdpa).toFixed(2) : '-'}</td>
            <td class="text-center" style="${Math.abs(f.biasPercent) > 10 ? 'color:#dc2626;font-weight:700;' : ''}">${f.biasPercent !== null && f.biasPercent !== undefined ? (f.biasPercent > 0 ? `+${f.biasPercent}%` : `${f.biasPercent}%`) : '-'}</td>
            <td class="text-center" style="font-weight:700;color:${f.statusText === 'Tidak Memuaskan' ? '#dc2626' : f.statusText === 'Peringatan' ? '#d97706' : '#16a34a'};">${f.zScore !== null && f.zScore !== undefined ? (f.zScore > 0 ? `+${Number(f.zScore).toFixed(2)}` : Number(f.zScore).toFixed(2)) : '-'}</td>
            <td class="text-center">
              <span class="${f.statusText === 'Tidak Memuaskan' ? 'badge-unsat' : f.statusText === 'Peringatan' ? 'badge-warn' : 'badge-sat'}">${f.statusText}</span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- FISHBONE MATRIX -->
    <div class="section-title">2. Matriks Investigasi Akar Masalah 6M (Fishbone Ishikawa)</div>
    <table>
      <thead>
        <tr class="th-indigo">
          <th style="width: 25px;">No</th>
          <th style="width: 130px;">Kategori 6M</th>
          <th>Temuan Akar Masalah (Root Cause Finding)</th>
          <th>Rekomendasi Tindakan Korektif & Preventif</th>
        </tr>
      </thead>
      <tbody>
        ${(data.fishbone || []).map((fb: any, idx: number) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${fb.category}</strong></td>
            <td>${fb.finding}</td>
            <td>${fb.action}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- CAPA & SIGNER -->
    <div class="capa-sig-grid">
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div class="capa-box" style="border-left: 3px solid #dc2626;">
          <h4 style="color:#b91c1c;">TINDAKAN KOREKTIF SEGERA (CORRECTIVE ACTIONS):</h4>
          <ul>
            ${(data.correctiveActions || []).map((ca: string) => `<li>${ca}</li>`).join('')}
          </ul>
        </div>
        <div class="capa-box" style="border-left: 3px solid #16a34a;">
          <h4 style="color:#15803d;">TINDAKAN PENCEGAHAN BERKELANJUTAN (PREVENTIVE ACTIONS):</h4>
          <ul>
            ${(data.preventiveActions || []).map((pa: string) => `<li>${pa}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div class="signer-box">
        <p style="margin:0;">${signer.tempat || "OKU Timur"}, ${signer.tanggal || "14 November 2027"}</p>
        <p style="margin:2px 0 0 0;font-size:9.5px;color:#475569;">${signer.jabatan || "Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan"}</p>
        <div class="signer-sig">${signer.namaPejabat ? signer.namaPejabat.split(",")[0] : "M.Didik Wahyudi"}</div>
        <div class="signer-name">${signer.namaPejabat || "M.Didik Wahyudi, S.Tr.Kes"}</div>
        <div style="font-size:9px;color:#64748b;margin-top:2px;">NIP ${signer.nip || "198408152009041001"}</div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer-note">
      * Dokumen Lembar Evaluasi & Analisis Mutu ISO 15189 ini bersifat RAHASIA dan diterbitkan secara resmi untuk ${targetLab}.
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

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
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner Modern Gradient & Dynamic Tenant Name */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-7 shadow-xl border border-teal-500/30 backdrop-blur-md">
        {/* Glow ambient effects */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-16 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-white/10 text-teal-300 border border-white/15 shadow-inner backdrop-blur-md shrink-0">
              <FileBarChart className="h-7 w-7 text-teal-300" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  Laporan Hasil PME <span className="text-teal-300">({tenantDisplayName})</span>
                </h1>
                {isSuperAdmin ? (
                  <Badge className="bg-teal-500 text-slate-950 hover:bg-teal-400 border-none text-xs font-bold font-mono px-2.5 py-0.5 shadow-sm">
                    Superadmin Mode
                  </Badge>
                ) : isReadOnly ? (
                  <Badge className="bg-sky-400 text-slate-950 hover:bg-sky-300 border-none text-xs font-bold font-mono px-2.5 py-0.5 shadow-sm">
                    ADMIN2 (LIHAT SAJA)
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-400 text-slate-950 hover:bg-emerald-300 border-none text-xs font-bold font-mono px-2.5 py-0.5 shadow-sm">
                    Laboratorium Peserta
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm font-medium text-teal-100/85 leading-relaxed max-w-3xl">
                {isSuperAdmin
                  ? "Validasi, koreksi hasil biostatistik ISO 13528, penandatanganan resmi, dan pengiriman laporan ke peserta"
                  : isReadOnly
                  ? "Pemeriksaan dan peninjauan laporan evaluasi mutu PME seluruh laboratorium peserta (Akses Lihat Saja)"
                  : "Lembar evaluasi mutu resmi hasil uji PME laboratorium yang diterbitkan oleh Balai Penyelenggara"}
              </p>
            </div>
          </div>

          {/* Action Buttons Header */}
          <div className="flex flex-wrap items-center gap-2.5 no-print shrink-0">
            {/* Tombol Atur KOP Surat (Khusus Superadmin) */}
            {isSuperAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsKopSuratModalOpen(true);
                }}
                className="text-xs sm:text-sm font-bold bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-xs"
              >
                <Building2 className="mr-1.5 h-4 w-4 text-teal-300" />
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
                className="text-xs sm:text-sm font-bold bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-xs"
              >
                <PenLine className="mr-1.5 h-4 w-4 text-teal-300" />
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
                className="text-xs sm:text-sm font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-100 border-sky-400/30 shadow-xs"
              >
                {validating ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-sky-300" />
                ) : (
                  <FileCheck2 className="mr-1.5 h-4 w-4 text-sky-300" />
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
                className={`text-xs sm:text-sm font-bold shadow-md ${
                  activeReport.isPublished
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-teal-600 hover:bg-teal-500 text-white"
                }`}
              >
                <Send className="mr-1.5 h-4 w-4" />
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
                className="text-xs sm:text-sm font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border-amber-400/30 shadow-xs"
              >
                {retracting ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-amber-300" />
                ) : (
                  <RotateCcw className="mr-1.5 h-4 w-4 text-amber-300" />
                )}
                Tarik / Batalkan
              </Button>
            )}

            {/* Tombol Analisa Hasil PME (Bisa diakses semua akun, dibatasi kuota bulanan oleh Superadmin) */}
            <Button
              size="sm"
              onClick={handleOpenPmeAnalysis}
              disabled={analyzingPme || loading}
              className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 text-xs sm:text-sm font-black shadow-lg gap-2 border border-amber-300/40"
            >
              {analyzingPme ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
              ) : (
                <Sparkles className="h-4 w-4 text-slate-950" />
              )}
              Analisa Hasil PME
              {quotaInfo && (
                <Badge
                  variant="outline"
                  className={`ml-1 text-[11px] px-1.5 py-0 font-mono font-black border-slate-900/30 ${
                    quotaInfo.remaining === 0 ? "bg-red-600 text-white" : "bg-white/40 text-slate-950"
                  }`}
                >
                  {quotaInfo.remaining}/{quotaInfo.limit}
                </Badge>
              )}
            </Button>

            {/* Tombol PDF & Cetak Hasil Analisis Model 1 jika hasil analisis sudah ada */}
            {analysisResult && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleDownloadAnalysisPdf(analysisResult)}
                  disabled={isExportingPdf}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-md gap-1.5"
                >
                  {isExportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  PDF Analisis (Model 1)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrintAnalysis(analysisResult)}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/25 text-xs sm:text-sm font-bold shadow-xs gap-1.5"
                >
                  <Printer className="h-4 w-4 text-teal-300" />
                  Cetak Analisis (Model 1)
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs sm:text-sm font-bold shadow-xs"
            >
              <Printer className="mr-1.5 h-4 w-4 text-teal-300" />
              Cetak Halaman
            </Button>

            {activeReport && (
              <Button
                size="sm"
                onClick={() => handleDownloadPdf(activeReport)}
                disabled={isExportingPdf}
                className="bg-teal-600 hover:bg-teal-500 text-white text-xs sm:text-sm font-bold shadow-md"
              >
                {isExportingPdf ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                Unduh PDF Resmi
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Banner Khusus Peran ADMIN2 (Lihat Saja) */}
      {isReadOnly && (
        <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between gap-3 text-xs text-sky-800 dark:text-sky-300 no-print">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-pulse shrink-0" />
            <p>
              <strong>Mode Lihat Saja (Read-Only):</strong> Anda masuk sebagai <strong>ADMIN2</strong>. Anda dapat melihat laporan hasil evaluasi biostatistik seluruh laboratorium peserta, mencetak halaman, atau mengunduh PDF resmi, namun tidak dapat melakukan validasi, pengiriman, atau pengaturan KOP surat dan penandatangan.
            </p>
          </div>
          <Badge variant="outline" className="bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30 shrink-0 text-[10px] font-bold">
            ADMIN2 (LIHAT SAJA)
          </Badge>
        </div>
      )}

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
                <Label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span>Siklus PME</span>
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setCustomCycleMode(!customCycleMode);
                    if (!customCycleMode) setCustomCycleInput(cycle);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:underline"
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
                    className="h-9 sm:h-10 text-xs sm:text-sm font-semibold"
                    onKeyDown={(e) => e.key === "Enter" && handleApplyCustomCycle()}
                  />
                  <Button
                    size="sm"
                    className="h-9 sm:h-10 px-3 text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleApplyCustomCycle}
                  >
                    Terapkan
                  </Button>
                </div>
              ) : (
                <Select value={cycle} onValueChange={handleCycleSelect}>
                  <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm font-semibold">
                    <SelectValue placeholder="Pilih Siklus" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCycles.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs sm:text-sm font-semibold">
                        {c}
                      </SelectItem>
                    ))}
                    {cycle && !availableCycles.includes(cycle) && (
                      <SelectItem value={cycle} className="text-xs sm:text-sm font-semibold">
                        {cycle}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Filter Kategori */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-teal-600" />
                <span>Kategori Paket</span>
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs sm:text-sm font-semibold">Semua Kategori</SelectItem>
                  <SelectItem value="Kimia Klinik" className="text-xs sm:text-sm font-semibold">Kimia Klinik</SelectItem>
                  <SelectItem value="Hematologi" className="text-xs sm:text-sm font-semibold">Hematologi</SelectItem>
                  <SelectItem value="Imunologi" className="text-xs sm:text-sm font-semibold">Imunologi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Peserta */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-amber-600" />
                <span>Pilih Peserta</span>
              </Label>
              <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
                <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm font-semibold">
                  <SelectValue placeholder="Semua Peserta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs sm:text-sm font-semibold">Semua Peserta ({participantReports.length})</SelectItem>
                  {participantReports.map((pr) => (
                    <SelectItem key={pr.participant.id} value={pr.participant.id} className="text-xs sm:text-sm font-semibold">
                      {pr.participant.participantCode ? `[${pr.participant.participantCode}] ` : ""}
                      {pr.participant.labName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Parameter Uji */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-indigo-600" />
                <span>Parameter Uji</span>
              </Label>
              <Select value={parameterFilter} onValueChange={setParameterFilter}>
                <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm font-semibold">
                  <SelectValue placeholder="Semua Parameter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs sm:text-sm font-semibold">Semua Parameter ({availableParameters.length})</SelectItem>
                  {availableParameters.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs sm:text-sm font-semibold">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Baris Kedua Filter: Status Evaluasi & Pencarian Cepat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2 border-t items-end">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-purple-600" />
                <span>Status Evaluasi</span>
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs sm:text-sm font-semibold">Semua Status</SelectItem>
                  <SelectItem value="SATISFACTORY" className="text-xs sm:text-sm font-semibold">Hanya Memuaskan (OK)</SelectItem>
                  <SelectItem value="WARNING" className="text-xs sm:text-sm font-semibold">Hanya Peringatan ($)</SelectItem>
                  <SelectItem value="UNSATISFACTORY" className="text-xs sm:text-sm font-semibold">Hanya Tidak Memuaskan (ACTION)</SelectItem>
                  <SelectItem value="OUTLIER" className="text-xs sm:text-sm font-semibold">Hanya Outlier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                <Search className="h-4 w-4 text-slate-500" />
                <span>Pencarian Cepat Parameter / Kode</span>
              </Label>
              <div className="relative">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ketik nama parameter (contoh: Glukosa, Kolesterol), metode, atau alat..."
                  className="h-9 sm:h-10 text-xs sm:text-sm pl-9 font-semibold"
                />
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
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
            <div className="space-y-6">
              {/* Selector Botol / Level Sampel (Sampel 1 & Sampel 2) */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 no-print">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-teal-600" />
                    Pilih Level / Botol Sampel:
                  </span>
                  <div className="inline-flex rounded-lg border p-1 bg-background shadow-xs gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedSample("Sampel 1")}
                      className={`px-3.5 py-1.5 text-xs sm:text-sm rounded-md font-bold transition-colors flex items-center gap-1.5 ${
                        selectedSample === "Sampel 1"
                          ? "bg-teal-700 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-teal-300" />
                      🧪 Sampel 1 (Level 1 / Normal)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSample("Sampel 2")}
                      className={`px-3.5 py-1.5 text-xs sm:text-sm rounded-md font-bold transition-colors flex items-center gap-1.5 ${
                        selectedSample === "Sampel 2"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-200" />
                      🧪 Sampel 2 (Level 2 / Patologis)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSample("ALL")}
                      className={`px-3.5 py-1.5 text-xs sm:text-sm rounded-md font-bold transition-colors ${
                        selectedSample === "ALL"
                          ? "bg-slate-800 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Semua Level (Sampel 1 & 2)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="font-bold text-muted-foreground">Botol Aktif:</span>
                  <Badge
                    variant="outline"
                    className={`font-bold text-xs px-3 py-1 ${
                      selectedSample === "Sampel 2"
                        ? "bg-amber-100 text-amber-900 border-amber-300"
                        : selectedSample === "Sampel 1"
                        ? "bg-teal-100 text-teal-900 border-teal-300"
                        : "bg-slate-100 text-slate-800 border-slate-300"
                    }`}
                  >
                    {selectedSample === "Sampel 2"
                      ? "🧪 Sampel 2: Level 2 (Patologis)"
                      : selectedSample === "Sampel 1"
                      ? "🧪 Sampel 1: Level 1 (Normal)"
                      : "Menampilkan Seluruh Level (1 & 2)"}
                  </Badge>
                </div>
              </div>

              {displayedReports.map((report) => {
                const displayRows = filterRows(report.rows);

                return (
                  <div
                    key={`${report.participant.id}-${report.sample || "S1"}`}
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
                      <div className="mt-1">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold ${
                          report.sample === "Sampel 2"
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-teal-100 text-teal-900 border border-teal-300"
                        }`}>
                          🧪 {report.sampleLabel || (report.sample === "Sampel 2" ? "Sampel 2 (Level 2 / Patologis)" : "Sampel 1 (Level 1 / Normal)")}
                        </span>
                      </div>
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
                        <div className="flex gap-2">
                          <span className="w-28 font-bold text-gray-700">Level / Sampel:</span>
                          <span className={`font-bold ${report.sample === "Sampel 2" ? "text-amber-800" : "text-teal-800"}`}>
                            {report.sampleLabel || (report.sample === "Sampel 2" ? "Sampel 2 (Level 2 / Patologis)" : "Sampel 1 (Level 1 / Normal)")}
                          </span>
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
            })}
          </div>
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
                className="text-xs sm:text-sm border-emerald-600/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold px-3.5 py-2 shadow-xs"
              >
                {isExportingRecapExcel ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
                )}
                Export Excel (.xlsx)
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadRecapPdf}
                disabled={isExportingRecapPdf || filteredRecapData.length === 0}
                className="text-xs sm:text-sm border-red-600/60 text-red-800 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold px-3.5 py-2 shadow-xs"
              >
                {isExportingRecapPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Download className="h-4 w-4 mr-1.5 text-red-600" />
                )}
                Export PDF (.pdf)
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handlePrint}
                disabled={filteredRecapData.length === 0}
                className="text-xs sm:text-sm border-slate-300 text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 font-bold px-3.5 py-2 shadow-xs"
              >
                <Printer className="h-4 w-4 mr-1.5 text-teal-600" />
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
                  <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    Filter Lengkap Rekapitulasi Data
                  </CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleResetRecapFilters}
                  className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Reset Filter
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              {/* Row 1: Siklus, Periode, Kategori, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Filter Siklus */}
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span>Siklus PME</span>
                  </Label>
                  <Select
                    value={cycle}
                    onValueChange={(val) => {
                      setCycle(val);
                      loadReports(val);
                    }}
                  >
                    <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm font-semibold">
                      <SelectValue placeholder="Pilih Siklus" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCycles.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs sm:text-sm font-semibold">
                          {c}
                        </SelectItem>
                      ))}
                      {cycle && !availableCycles.includes(cycle) && (
                        <SelectItem value={cycle} className="text-xs sm:text-sm font-semibold">
                          {cycle}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Periode */}
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span>Periode / Tahap</span>
                  </Label>
                  <Select value={recapPeriod} onValueChange={setRecapPeriod}>
                    <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm font-semibold">
                      <SelectValue placeholder="Semua Periode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs sm:text-sm font-semibold">
                        Semua Periode
                      </SelectItem>
                      {recapAvailablePeriods.map((p) => (
                        <SelectItem key={p} value={p} className="text-xs sm:text-sm font-semibold">
                          Periode {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Kategori Paket */}
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-teal-600" />
                    <span>Kategori Paket</span>
                  </Label>
                  <Select value={recapCategory} onValueChange={setRecapCategory}>
                    <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm font-semibold">
                      <SelectValue placeholder="Semua Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs sm:text-sm font-semibold">
                        Semua Kategori
                      </SelectItem>
                      {recapAvailableCategories.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-xs sm:text-sm font-semibold">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Status Kinerja */}
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Award className="h-4 w-4 text-purple-600" />
                    <span>Status Evaluasi Mutu</span>
                  </Label>
                  <Select value={recapStatus} onValueChange={setRecapStatus}>
                    <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm font-semibold">
                      <SelectValue placeholder="Semua Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs sm:text-sm font-semibold">
                        Semua Status Kinerja
                      </SelectItem>
                      <SelectItem value="SATISFACTORY" className="text-xs sm:text-sm font-semibold text-emerald-600">
                        Memuaskan (|Z| ≤ 2.0)
                      </SelectItem>
                      <SelectItem value="WARNING" className="text-xs sm:text-sm font-semibold text-amber-600">
                        Peringatan (2.0 &lt; |Z| &lt; 3.0)
                      </SelectItem>
                      <SelectItem value="UNSATISFACTORY" className="text-xs sm:text-sm font-semibold text-red-600">
                        Tidak Memuaskan (|Z| ≥ 3.0)
                      </SelectItem>
                      <SelectItem value="NOT_EXAMINED" className="text-xs sm:text-sm font-semibold text-slate-500">
                        Parameter Tidak Diperiksa / Kosong
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Laboratorium, Level Sampel, Parameter, Pencarian Cepat */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
                {/* Filter Laboratorium */}
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-indigo-600" />
                    <span>Laboratorium Peserta</span>
                  </Label>
                  <Select value={recapParticipant} onValueChange={setRecapParticipant}>
                    <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm font-semibold">
                      <SelectValue placeholder="Semua Laboratorium" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs sm:text-sm font-semibold">
                        Semua Laboratorium ({recapAvailableParticipants.length})
                      </SelectItem>
                      {recapAvailableParticipants.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs sm:text-sm font-semibold">
                          {p.name} {p.code && p.code !== "-" ? `(${p.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Level / Botol Sampel */}
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-teal-600" />
                    <span>Level / Sampel</span>
                  </Label>
                  <Select value={recapSample} onValueChange={setRecapSample}>
                    <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm font-semibold">
                      <SelectValue placeholder="Semua Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs sm:text-sm font-semibold">
                        Semua Level (Sampel 1 & 2)
                      </SelectItem>
                      <SelectItem value="Sampel 1" className="text-xs sm:text-sm font-semibold text-teal-700">
                        🧪 Sampel 1 (Level 1 / Normal)
                      </SelectItem>
                      <SelectItem value="Sampel 2" className="text-xs sm:text-sm font-semibold text-amber-700">
                        🧪 Sampel 2 (Level 2 / Patologis)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Parameter */}
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-emerald-600" />
                    <span>Parameter Pemeriksaan</span>
                  </Label>
                  <Select value={recapParameter} onValueChange={setRecapParameter}>
                    <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm font-semibold">
                      <SelectValue placeholder="Semua Parameter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs sm:text-sm font-semibold">
                        Semua Parameter ({recapAvailableParameters.length})
                      </SelectItem>
                      {recapAvailableParameters.map((param) => (
                        <SelectItem key={param} value={param} className="text-xs sm:text-sm font-semibold">
                          {param}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pencarian Cepat Teks */}
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Search className="h-4 w-4 text-slate-500" />
                    <span>Pencarian Cepat</span>
                  </Label>
                  <div className="relative">
                    <Input
                      value={recapSearch}
                      onChange={(e) => setRecapSearch(e.target.value)}
                      placeholder="Cari Lab, Parameter, Alat..."
                      className="h-9 sm:h-10 text-xs sm:text-sm pl-9 font-semibold"
                    />
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    {recapSearch && (
                      <button
                        onClick={() => setRecapSearch("")}
                        className="absolute right-3 top-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
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
                      <th className="p-2 border border-teal-800 w-24 text-center">Sampel / Level</th>
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
                          <td className="p-2 border border-slate-200 text-center">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                d.sample === "Sampel 2"
                                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                                  : "bg-teal-100 text-teal-900 border border-teal-300"
                              }`}
                            >
                              {d.sampleLabel || d.sample}
                            </span>
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

      {/* 1. MODAL PEMILIHAN LEVEL & INISIASI ANALISIS HASIL PME */}
      <Dialog open={isAnalysisSetupOpen} onOpenChange={setIsAnalysisSetupOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Sparkles className="h-5 w-5 text-teal-600" />
              <span>Analisa Hasil PME Cerdas (ISO 15189)</span>
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed pt-1">
              Evaluasi kinerja biostatistik ISO 13528, deteksi pola bias analitik, investigasi akar masalah Fishbone 6M, dan rekomendasi tindakan korektif & preventif (CAPA).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Kartu Status Kuota Organisasi */}
            <div className="p-3.5 rounded-xl border bg-gradient-to-r from-teal-500/10 to-indigo-500/10 border-teal-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-teal-600" />
                  Alokasi Kuota Analisis Bulan Ini
                </span>
                <Badge
                  variant="outline"
                  className={
                    quotaInfo && quotaInfo.remaining > 0
                      ? "bg-teal-600 text-white font-mono font-bold border-none"
                      : "bg-red-600 text-white font-mono font-bold border-none"
                  }
                >
                  {quotaInfo ? `${quotaInfo.remaining} / ${quotaInfo.limit} Sisa` : "Memuat..."}
                </Badge>
              </div>

              {quotaInfo && (
                <div className="space-y-1">
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        quotaInfo.usagePct >= 90
                          ? "bg-red-500"
                          : quotaInfo.usagePct >= 70
                          ? "bg-amber-500"
                          : "bg-teal-600"
                      }`}
                      style={{ width: `${quotaInfo.usagePct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Terpakai: {quotaInfo.used} kali ({quotaInfo.usagePct}%)</span>
                    <span>Tersisa: {quotaInfo.remaining} kali</span>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground italic leading-tight">
                * Batasan kuota analisis bulanan diberikan dan dikelola oleh Superadmin pada menu <strong>Pengaturan</strong> (tabel Kelola Kuota Organisasi & Laboratorium).
              </p>
            </div>

            {/* Pilihan Level Sampel untuk Analisis */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-teal-600" />
                Pilih Botol / Level Sampel yang Dianalisa:
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setAnalysisSampleTarget("Sampel 1")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    analysisSampleTarget === "Sampel 1"
                      ? "border-teal-600 bg-teal-50/60 dark:bg-teal-950/40 ring-2 ring-teal-600/30"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-800 dark:text-teal-300 text-xs">
                      🧪 Sampel 1
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-teal-100 text-teal-800 border-teal-300">
                      Level 1
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">
                    Konsentrasi normal / fisiologis. Untuk verifikasi presisi dan evaluasi bias stabilitas analitik baseline.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAnalysisSampleTarget("Sampel 2")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    analysisSampleTarget === "Sampel 2"
                      ? "border-amber-600 bg-amber-50/60 dark:bg-amber-950/40 ring-2 ring-amber-600/30"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-800 dark:text-amber-300 text-xs">
                      🧪 Sampel 2
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                      Level 2
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">
                    Konsentrasi patologis / abnormal. Untuk menguji sensitivitas analitik pada batas keputusan klinis (cut-off).
                  </p>
                </button>
              </div>
            </div>

            {/* Target Laboratorium */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Laboratorium Target:</span>
                <span className="font-semibold text-foreground">
                  {selectedParticipantId !== "ALL"
                    ? activeReport?.participant.labName
                    : isSuperAdmin
                    ? activeReport?.participant.labName || "Laboratorium Terpilih"
                    : "Laboratorium Anda"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Siklus PME:</span>
                <span className="font-mono font-semibold text-foreground">{cycle || "-"}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAnalysisSetupOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={analyzingPme || (quotaInfo !== null && quotaInfo.remaining <= 0)}
              onClick={() => handleRunPmeAnalysis(analysisSampleTarget)}
              className="bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-800 hover:to-indigo-800 text-white font-semibold"
            >
              {analyzingPme ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4 text-amber-300" />
              )}
              Mulai Analisa Sekarang (1 Kuota)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. MODAL HASIL ANALISIS MUTU PME LENGKAP (ISO 15189, FISHBONE 6M, CAPA) */}
      <Dialog open={isAnalysisModalOpen} onOpenChange={setIsAnalysisModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  <Sparkles className="h-5 w-5 text-teal-600" />
                  <span>Laporan Analisis Mutu PME Cerdas & Rekomendasi CAPA</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {analysisResult?.participantName} ({analysisResult?.participantCode}) • Siklus {analysisResult?.cycle} • {analysisResult?.sampleLabel}
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                {quotaInfo && (
                  <Badge variant="outline" className="font-mono text-xs bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300">
                    Sisa Kuota: {quotaInfo.remaining} / {quotaInfo.limit}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePrintAnalysis(analysisResult)}
                  className="h-7 text-xs font-bold border-slate-300 dark:border-slate-700"
                  title="Cetak format evaluasi Model 1"
                >
                  <Printer className="h-3.5 w-3.5 mr-1 text-teal-600" />
                  Cetak
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleDownloadAnalysisPdf(analysisResult)}
                  disabled={isExportingPdf}
                  className="h-7 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white"
                  title="Unduh PDF Model 1"
                >
                  {isExportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  PDF Model 1
                </Button>
              </div>
            </div>
          </DialogHeader>

          {analysisResult && (
            <div className="space-y-5 py-3 text-xs">
              {/* Top KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <Card className="p-3 border shadow-xs bg-slate-50 dark:bg-slate-900/60">
                  <p className="text-[11px] text-muted-foreground font-medium">Parameter Diuji</p>
                  <h4 className="text-xl font-bold mt-1 text-foreground">{analysisResult.totalParameters}</h4>
                </Card>
                <Card className="p-3 border shadow-xs bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-500/20">
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Memuaskan (|Z| ≤ 2)</p>
                  <h4 className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">
                    {analysisResult.satisfactoryCount}
                  </h4>
                </Card>
                <Card className="p-3 border shadow-xs bg-amber-50/60 dark:bg-amber-950/20 border-amber-500/20">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Peringatan (2 &lt; |Z| &lt; 3)</p>
                  <h4 className="text-xl font-bold mt-1 text-amber-700 dark:text-amber-400">
                    {analysisResult.warningCount}
                  </h4>
                </Card>
                <Card className="p-3 border shadow-xs bg-red-50/60 dark:bg-red-950/20 border-red-500/20">
                  <p className="text-[11px] text-red-700 dark:text-red-400 font-medium">Tdk Memuaskan (|Z| ≥ 3)</p>
                  <h4 className="text-xl font-bold mt-1 text-red-700 dark:text-red-400">
                    {analysisResult.unsatisfactoryCount}
                  </h4>
                </Card>
                <Card className="p-3 border shadow-xs bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-500/20 col-span-2 sm:col-span-1">
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium">Pass Rate</p>
                  <h4 className="text-xl font-bold mt-1 text-indigo-700 dark:text-indigo-400">
                    {analysisResult.passRate}%
                  </h4>
                </Card>
              </div>

              {/* 1. Ringkasan Kinerja Klinis */}
              <div className="p-4 rounded-xl border bg-card space-y-2">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Award className="h-4 w-4 text-teal-600" />
                  <span>Ringkasan Klinis & Kinerja Analitik</span>
                </h4>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {analysisResult.clinicalSummary}
                </p>
              </div>

              {/* 2. Observasi Bias Sistematik */}
              <div className="p-4 rounded-xl border bg-card space-y-2.5">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span>Observasi Bias & Deviasi Sistematik per Parameter</span>
                </h4>
                <div className="space-y-2">
                  {analysisResult.biasObservations?.map((obs: string, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border flex items-start gap-2.5"
                    >
                      <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-slate-800 dark:text-slate-200 leading-relaxed text-[11.5px]">{obs}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Matriks Fishbone 6M */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-600" />
                  <span>Matriks Investigasi Akar Masalah 6M (Fishbone Ishikawa)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {analysisResult.fishbone?.map((item: any, idx: number) => (
                    <Card key={idx} className="p-3 border shadow-2xs space-y-2">
                      <div className="flex items-center justify-between border-b pb-1.5">
                        <span className="font-bold text-xs text-foreground">{item.category}</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Temuan:</p>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug">{item.finding}</p>
                      </div>
                      <div className="space-y-1 pt-1 border-t">
                        <p className="text-[10px] font-semibold text-teal-700 dark:text-teal-400 uppercase">Rekomendasi Aksi:</p>
                        <p className="text-[11px] text-slate-800 dark:text-slate-200 leading-snug">{item.action}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* 4. Rekomendasi Tindakan Korektif & Preventif (CAPA) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Corrective Actions */}
                <div className="p-4 rounded-xl border bg-card space-y-2.5">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-red-700 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Tindakan Korektif Segera (Corrective Actions)</span>
                  </h4>
                  <ul className="space-y-1.5 list-disc list-inside text-slate-700 dark:text-slate-300">
                    {analysisResult.correctiveActions?.map((act: string, idx: number) => (
                      <li key={idx} className="leading-snug text-[11px]">
                        {act}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Preventive Actions */}
                <div className="p-4 rounded-xl border bg-card space-y-2.5">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>Tindakan Pencegahan Berkelanjutan (Preventive Actions)</span>
                  </h4>
                  <ul className="space-y-1.5 list-disc list-inside text-slate-700 dark:text-slate-300">
                    {analysisResult.preventiveActions?.map((act: string, idx: number) => (
                      <li key={idx} className="leading-snug text-[11px]">
                        {act}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 5. Tabel Temuan Evaluasi Biostatistik */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-teal-600" />
                  <span>Rincian Evaluasi Hasil Pengujian per Parameter</span>
                </h4>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/70 text-slate-700 dark:text-slate-300 font-semibold border-b">
                      <tr>
                        <th className="p-2 text-center w-8">No</th>
                        <th className="p-2 text-left">Parameter</th>
                        <th className="p-2 text-right">Hasil Lab</th>
                        <th className="p-2 text-right">Target Konsensus</th>
                        <th className="p-2 text-right">SDPA</th>
                        <th className="p-2 text-center">Bias %</th>
                        <th className="p-2 text-center">Z-Score</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {analysisResult.evaluationFindings?.map((f: any, idx: number) => {
                        const isAction = f.statusText === "Tidak Memuaskan";
                        const isWarn = f.statusText === "Peringatan";
                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-muted/20 ${
                              isAction ? "bg-red-50/40 dark:bg-red-950/20" : isWarn ? "bg-amber-50/30 dark:bg-amber-950/20" : ""
                            }`}
                          >
                            <td className="p-2 text-center font-mono text-muted-foreground">{idx + 1}</td>
                            <td className="p-2">
                              <span className="font-semibold text-foreground">{f.parameterName}</span>
                              <span className="text-[10px] text-muted-foreground ml-1 font-mono">({f.unit})</span>
                            </td>
                            <td className="p-2 text-right font-mono font-bold">{f.value}</td>
                            <td className="p-2 text-right font-mono">{f.target}</td>
                            <td className="p-2 text-right font-mono">{f.sdpa}</td>
                            <td className="p-2 text-center font-mono">
                              {f.biasPercent !== null ? (
                                <span className={Math.abs(f.biasPercent) > 10 ? "text-red-600 font-bold" : ""}>
                                  {f.biasPercent > 0 ? `+${f.biasPercent}%` : `${f.biasPercent}%`}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="p-2 text-center font-mono font-bold">
                              <span className={isAction ? "text-red-700" : isWarn ? "text-amber-700" : "text-emerald-700"}>
                                {f.zScore > 0 ? `+${f.zScore.toFixed(2)}` : f.zScore.toFixed(2)}
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              <Badge
                                variant="outline"
                                className={
                                  isAction
                                    ? "bg-red-100 text-red-800 border-red-300"
                                    : isWarn
                                    ? "bg-amber-100 text-amber-800 border-amber-300"
                                    : "bg-emerald-100 text-emerald-800 border-emerald-300"
                                }
                              >
                                {f.statusText}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {analysisResult?.sample === "Sampel 1" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAnalysisSampleTarget("Sampel 2");
                    handleRunPmeAnalysis("Sampel 2");
                  }}
                  disabled={analyzingPme || (quotaInfo !== null && quotaInfo.remaining <= 0)}
                  className="text-xs border-amber-600/40 text-amber-800 dark:text-amber-300 hover:bg-amber-50"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
                  Analisa Sampel 2 (Level 2)
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAnalysisSampleTarget("Sampel 1");
                    handleRunPmeAnalysis("Sampel 1");
                  }}
                  disabled={analyzingPme || (quotaInfo !== null && quotaInfo.remaining <= 0)}
                  className="text-xs border-teal-600/40 text-teal-800 dark:text-teal-300 hover:bg-teal-50"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-teal-600" />
                  Analisa Sampel 1 (Level 1)
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePrintAnalysis(analysisResult)}
                className="text-xs font-bold border-teal-600/50 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"
              >
                <Printer className="mr-1.5 h-4 w-4 text-teal-700 dark:text-teal-400" />
                Cetak Laporan Analisis (Model 1)
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleDownloadAnalysisPdf(analysisResult)}
                disabled={isExportingPdf}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs"
              >
                {isExportingPdf ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                Unduh PDF Analisis (Format Model 1)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setIsAnalysisModalOpen(false)}
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Tutup
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. MODAL PERINGATAN KUOTA HABIS (DIATUR OLEH SUPERADMIN) */}
      <Dialog open={isQuotaExhaustedModalOpen} onOpenChange={setIsQuotaExhaustedModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-600">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              <span>Kuota Analisis Hasil PME Telah Habis</span>
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed pt-1">
              Laboratorium Anda telah mencapai batasan kuota analisis bulanan yang dialokasikan oleh Superadmin.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-xs space-y-3 bg-red-50/60 dark:bg-red-950/20 p-4 rounded-xl border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between border-b border-red-200 dark:border-red-800 pb-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Status Kuota Bulanan:</span>
              <Badge variant="destructive" className="font-mono font-bold">
                {quotaInfo?.used ?? 0} / {quotaInfo?.limit ?? 0} (0 Tersisa)
              </Badge>
            </div>

            <div className="space-y-1.5 text-slate-700 dark:text-slate-300 leading-relaxed text-[11.5px]">
              <p>
                Fitur <strong>Analisa Hasil PME</strong> dapat diakses oleh semua akun pengguna, tetapi dibatasi oleh alokasi kuota bulanan organisasi yang diberikan secara eksklusif oleh akun <strong>Superadmin</strong>.
              </p>
              <p>
                Pengaturan penambahan kuota dilakukan pada menu <strong>Pengaturan</strong> di tabel <strong>"Kelola Kuota Organisasi & Laboratorium (Superadmin)"</strong>.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border text-[11px] text-muted-foreground flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                {isSuperAdmin
                  ? "Sebagai Superadmin, Anda dapat segera menaikkan batas kuota bulanan organisasi ini di menu Pengaturan."
                  : "Silakan hubungi Superadmin atau penyelenggara PME untuk mengajukan permohonan penambahan kuota analisis laboratorium Anda."}
              </span>
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQuotaExhaustedModalOpen(false)}
            >
              Tutup
            </Button>
            {isSuperAdmin && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setIsQuotaExhaustedModalOpen(false);
                  navigate("settings");
                }}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
              >
                Buka Menu Pengaturan
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
