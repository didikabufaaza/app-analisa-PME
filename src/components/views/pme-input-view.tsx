"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FilePenLine,
  Send,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  PackageCheck,
  Zap,
  Clock,
  Check,
  AlertTriangle,
  Lock,
  Unlock,
  ShieldCheck,
  Printer,
  Download,
  Save,
  BookmarkCheck,
  FileText,
  ChevronDown,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PmeCountdownTimer } from "@/components/pme/pme-countdown-timer";

interface ParameterRow {
  id: string;
  name: string;
  unit: string | null;
  packageName: string;
  defaultMethodCode: string | null;
  defaultInstrumentCode: string | null;
  sortOrder: number;
  value: string;
  methodCode: string;
  instrumentCode: string;
  reagentName: string;
}

interface ParticipantOption {
  id: string;
  labName: string;
  participantCode: string | null;
  cycle?: string | null;
  status: string; // "PENDING" | "APPROVED" | "REJECTED"
}

export function PmeInputView() {
  const { user, navigate, viewAsTenantId } = useAppStore();
  const { toast } = useToast();

  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
  const [selectedCycle, setSelectedCycle] = useState<string>("Siklus 1 2026");
  const [period, setPeriod] = useState<string>("Tahap 2");

  const [loading, setLoading] = useState(false);
  const [registeredPackages, setRegisteredPackages] = useState<{ id: string; name: string; category: string }[]>([]);
  const [parameters, setParameters] = useState<ParameterRow[]>([]);
  const [hasNoPackages, setHasNoPackages] = useState(false);
  const [isNotApproved, setIsNotApproved] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState("");
  const [approvingParticipant, setApprovingParticipant] = useState(false);
  const [isSubmittedBefore, setIsSubmittedBefore] = useState(false);
  const [lastSubmittedAt, setLastSubmittedAt] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [allowResubmit, setAllowResubmit] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Master Data & Kop Surat States
  const [masterInstruments, setMasterInstruments] = useState<{ id: string; code: string; name: string }[]>([]);
  const [masterMethods, setMasterMethods] = useState<{ id: string; code: string; name: string }[]>([]);
  const [masterReagents, setMasterReagents] = useState<{ id: string; code: string; name: string }[]>([]);
  const [kopSurat, setKopSurat] = useState<any>(null);

  // Draft and Deadline States
  const [isDraft, setIsDraft] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [deadlineInfo, setDeadlineInfo] = useState<{
    submissionDeadline: string | null;
    customDeadline: string | null;
    effectiveDeadline: string | null;
    isSubmissionOpen: boolean;
    allowExpiredInput: boolean;
    isExpired: boolean;
  } | null>(null);

  // Quick Batch Fill Helper (Untuk mempercepat pengisian alat & metode yang sama)
  const [batchMethod, setBatchMethod] = useState("");
  const [batchInstrument, setBatchInstrument] = useState("");
  const [batchReagent, setBatchReagent] = useState("");

  // Load participants list, active PME config, master data, and kop surat
  useEffect(() => {
    Promise.all([
      fetch("/api/pme-mgmt/participants", { credentials: "same-origin" }),
      fetch("/api/pme-mgmt/config", { credentials: "same-origin" }),
      fetch("/api/pme-mgmt/master", { credentials: "same-origin" }),
      fetch("/api/kop-surat", { credentials: "same-origin" }),
    ])
      .then(async ([pRes, cRes, mRes, kRes]) => {
        if (cRes.ok) {
          const cData = await cRes.json();
          if (cData.config?.activeCycle) {
            setSelectedCycle(cData.config.activeCycle);
          }
          if (cData.config?.activePeriod) {
            setPeriod(cData.config.activePeriod);
          }
        }

        if (pRes.ok) {
          const pData = await pRes.json();
          setParticipants(pData.participants || []);
          if (pData.participants && pData.participants.length > 0 && !selectedParticipantId) {
            setSelectedParticipantId(pData.participants[0].id);
          }
        }

        if (mRes && mRes.ok) {
          const mData = await mRes.json();
          setMasterInstruments(mData.instruments || []);
          setMasterMethods(mData.methods || []);
          setMasterReagents(mData.reagents || []);
        }

        if (kRes && kRes.ok) {
          const kData = await kRes.json();
          setKopSurat(kData.kopSurat || null);
        }
      })
      .catch(() => undefined);
  }, [viewAsTenantId]);

  const handleSelectParticipant = (pId: string) => {
    setSelectedParticipantId(pId);
  };

  const handleApproveParticipant = async (pId: string) => {
    if (!pId) return;
    setApprovingParticipant(true);
    try {
      const res = await fetch("/api/pme-mgmt/participants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id: pId, action: "approve" }),
      });
      if (res.ok) {
        toast({
          title: "Laboratorium Disetujui",
          description: "Laboratorium disetujui. Memuat formulir hasil PME...",
        });
        const pRes = await fetch("/api/pme-mgmt/participants", { credentials: "same-origin" });
        if (pRes.ok) {
          const pData = await pRes.json();
          setParticipants(pData.participants || []);
        }
        await loadParticipantParams();
      } else {
        const err = await res.json();
        toast({ title: "Gagal menyetujui", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", variant: "destructive" });
    } finally {
      setApprovingParticipant(false);
    }
  };

  // Load parameters for selected participant & cycle
  const loadParticipantParams = async () => {
    if (!selectedParticipantId) return;
    setLoading(true);
    setHasNoPackages(false);
    setIsNotApproved(false);
    setApprovalMessage("");

    try {
      const res = await fetch(
        `/api/pme-mgmt/submissions?participantId=${selectedParticipantId}&cycle=${encodeURIComponent(selectedCycle)}`,
        { credentials: "same-origin" }
      );

      if (res.ok) {
        const data = await res.json();

        // Cek apakah laboratorium belum disetujui oleh Superadmin
        if (data.isApproved === false) {
          setIsNotApproved(true);
          setApprovalMessage(data.message || "Pendaftaran laboratorium ini belum disetujui oleh Superadmin.");
          setRegisteredPackages([]);
          setParameters([]);
          setIsSubmittedBefore(false);
          setSubmissionId(null);
          setCanEdit(false);
          return;
        }

        setRegisteredPackages(data.registeredPackages || []);

        if (!data.registeredPackages || data.registeredPackages.length === 0) {
          setHasNoPackages(true);
          setParameters([]);
          setIsSubmittedBefore(false);
          setSubmissionId(null);
          setCanEdit(true);
          return;
        }

        // Map parameters with existing submission results if already submitted
        const existingResults = data.submission?.results || [];
        const isDraftStatus = Boolean(data.isDraft || data.submission?.status === "DRAFT");
        const isSubmittedStatus = Boolean(data.isSubmitted && data.submission?.status !== "DRAFT");

        setIsDraft(isDraftStatus);
        setIsSubmittedBefore(isSubmittedStatus);
        setLastSubmittedAt(data.submission?.submittedAt || null);
        setSubmissionId(data.submission?.id || null);
        setIsLocked(Boolean(data.isLocked));
        setAllowResubmit(Boolean(data.allowResubmit));
        setDeadlineInfo(data.deadlineInfo || null);

        // Selalu perbarui master data dari response agar formulir peserta selalu sinkron
        if (Array.isArray(data.masterInstruments) && data.masterInstruments.length > 0) {
          setMasterInstruments(data.masterInstruments);
        }
        if (Array.isArray(data.masterMethods) && data.masterMethods.length > 0) {
          setMasterMethods(data.masterMethods);
        }
        if (Array.isArray(data.masterReagents) && data.masterReagents.length > 0) {
          setMasterReagents(data.masterReagents);
        }

        const isSuper = user?.role === "SUPERADMIN";
        if (!isSuper && data.deadlineInfo?.isExpired && !data.deadlineInfo?.allowExpiredInput) {
          setCanEdit(false);
        } else if (!isSuper && !data.deadlineInfo?.isSubmissionOpen && !data.deadlineInfo?.allowExpiredInput) {
          setCanEdit(false);
        } else {
          setCanEdit(data.canEdit !== undefined ? Boolean(data.canEdit) : !isSubmittedStatus);
        }

        const rows: ParameterRow[] = (data.parameters || []).map((p: any) => {
          const matchedResult = existingResults.find(
            (r: any) => r.parameterName.toLowerCase().trim() === p.name.toLowerCase().trim()
          );

          return {
            id: p.id,
            name: p.name,
            unit: p.unit,
            packageName: p.packageName,
            defaultMethodCode: p.defaultMethodCode,
            defaultInstrumentCode: p.defaultInstrumentCode,
            sortOrder: p.sortOrder,
            value: matchedResult && matchedResult.value !== null ? String(matchedResult.value) : "",
            methodCode: matchedResult?.methodCode || p.defaultMethodCode || "",
            instrumentCode: matchedResult?.instrumentCode || p.defaultInstrumentCode || "",
            reagentName: matchedResult?.reagentName || "",
          };
        });

        setParameters(rows);
      } else {
        const err = await res.json();
        toast({ title: "Gagal memuat formulir", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Gagal memuat parameter", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedParticipantId && selectedCycle) {
      loadParticipantParams();
    }
  }, [selectedParticipantId, selectedCycle]);

  const handleRowChange = (index: number, field: keyof ParameterRow, value: string) => {
    setParameters((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleApplyBatch = () => {
    if (!batchMethod && !batchInstrument && !batchReagent) {
      toast({ title: "Isi template seragam terlebih dahulu." });
      return;
    }
    setParameters((prev) =>
      prev.map((row) => ({
        ...row,
        methodCode: batchMethod ? batchMethod : row.methodCode,
        instrumentCode: batchInstrument ? batchInstrument : row.instrumentCode,
        reagentName: batchReagent ? batchReagent : row.reagentName,
      }))
    );
    toast({ title: "Template seragam diterapkan ke seluruh baris parameter." });
  };

  const handleToggleLock = async (unlock: boolean) => {
    if (!selectedParticipantId) return;
    setTogglingLock(true);
    try {
      const res = await fetch("/api/pme-mgmt/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: unlock ? "UNLOCK_SUBMISSION" : "LOCK_SUBMISSION",
          submissionId: submissionId || undefined,
          participantId: selectedParticipantId,
          cycle: selectedCycle,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: unlock ? "Kunci Input Dibuka" : "Formulir Dikunci Kembali",
          description: data.message,
        });
        await loadParticipantParams();
      } else {
        const err = await res.json();
        toast({
          title: "Gagal mengubah status kunci",
          description: err.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Kesalahan jaringan",
        description: "Gagal mengubah status penguncian.",
        variant: "destructive",
      });
    } finally {
      setTogglingLock(false);
    }
  };

  // Validasi sebelum membuka dialog konfirmasi
  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isFormLocked) {
      toast({
        title: "Formulir Terkunci",
        description: "Hasil telah dikirim atau waktu pengisian berakhir.",
        variant: "destructive",
      });
      return;
    }

    const filledRows = parameters.filter((p) => p.value.trim() !== "");
    if (filledRows.length === 0) {
      toast({
        title: "Hasil Masih Kosong",
        description: "Silakan isi minimal satu nilai hasil pemeriksaan sebelum mengirim.",
        variant: "destructive",
      });
      return;
    }

    // Buka kotak dialog konfirmasi pengiriman
    setConfirmDialogOpen(true);
  };

  // Simpan Draft Hasil PME (tanpa mengunci formulir, status DRAFT)
  const handleSaveDraft = async () => {
    if (isFormLocked) {
      toast({
        title: "Formulir Terkunci",
        description: "Pengisian hasil sedang terkunci dan tidak dapat disimpan.",
        variant: "destructive",
      });
      return;
    }

    const filledRows = parameters.filter((p) => p.value.trim() !== "");
    if (filledRows.length === 0) {
      toast({
        title: "Belum Ada Hasil",
        description: "Silakan isi minimal satu nilai hasil pemeriksaan untuk disimpan sebagai draft.",
        variant: "destructive",
      });
      return;
    }

    setSavingDraft(true);
    try {
      const payload = {
        participantId: selectedParticipantId,
        cycle: selectedCycle.trim(),
        period: period.trim() || undefined,
        action: "SAVE_DRAFT",
        isDraft: true,
        results: parameters
          .filter((p) => p.value.trim() !== "")
          .map((p) => ({
            parameterId: p.id,
            parameterName: p.name,
            unit: p.unit,
            value: parseFloat(p.value.replace(/,/g, ".")),
            methodCode: p.methodCode,
            instrumentCode: p.instrumentCode,
            reagentName: p.reagentName,
          })),
      };

      const res = await fetch("/api/pme-mgmt/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Draft Hasil Berhasil Disimpan",
          description: data.message || "Data tersimpan sementara. Formulir tetap terbuka untuk Anda lengkapi kembali.",
        });
        setIsDraft(true);
        if (data.submissionId) {
          setSubmissionId(data.submissionId);
        }
        await loadParticipantParams();
      } else {
        const err = await res.json();
        toast({ title: "Gagal menyimpan draft", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Gagal menyimpan draft hasil.", variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  };

  // Cetak / Print Draft Lembar Hasil
  const handlePrintDraft = () => {
    window.print();
  };

  // Unduh PDF Draft Lembar Hasil Lengkap KOP Surat
  const handleDownloadPdf = () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 12;
      let y = 10;
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

      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(
        (kopSurat?.namaRumahSakit || "BALAI BESAR LABORATORIUM KESEHATAN MASYARAKAT PALEMBANG").toUpperCase(),
        pageW / 2,
        y + 8,
        { align: "center" }
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        kopSurat?.alamatRumahSakit || "Jl. Inspektur Yazid No.2, Sekip Jaya, Palembang, Sumatera Selatan",
        pageW / 2,
        y + 12.5,
        { align: "center" }
      );
      doc.text(
        kopSurat?.kontakRumahSakit || "Telp: (0711) 352 683 | Email: bblabkesmaspalembang@kemkes.go.id",
        pageW / 2,
        y + 16.5,
        { align: "center" }
      );

      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.6);
      doc.line(margin, y + 19, pageW - margin, y + 19);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 19.8, pageW - margin, y + 19.8);

      y += 26;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("DRAFT HASIL PENGUJIAN PME (SEMENTARA)", pageW / 2, y, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Lembar Verifikasi Internal Hasil Uji Sebelum Pengiriman Final", pageW / 2, y + 4.5, { align: "center" });

      y += 10;
      const selectedP = participants.find((p) => p.id === selectedParticipantId);
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);

      doc.setFont("helvetica", "bold");
      doc.text("Nama Laboratorium", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${selectedP?.labName || "-"}`, margin + 32, y);

      doc.setFont("helvetica", "bold");
      doc.text("Kode Peserta", margin, y + 4.5);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${selectedP?.participantCode || "-"}`, margin + 32, y + 4.5);

      doc.setFont("helvetica", "bold");
      doc.text("Siklus & Periode", pageW / 2, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${selectedCycle} (${period})`, pageW / 2 + 28, y);

      doc.setFont("helvetica", "bold");
      doc.text("Status Lembar", pageW / 2, y + 4.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(180, 83, 9);
      doc.text(
        isSubmittedBefore ? ": SUDAH DIKIRIM FINAL" : isDraft ? ": DRAFT SEMENTARA (TERSUSUN)" : ": DRAFT SEMENTARA",
        pageW / 2 + 28,
        y + 4.5
      );

      y += 10;

      const tableBody = parameters.map((p, idx) => [
        idx + 1,
        p.name,
        p.unit || "-",
        p.value ? p.value : "(Belum diisi)",
        p.methodCode || "-",
        p.instrumentCode || "-",
        p.reagentName || "-",
      ]);

      autoTable(doc, {
        startY: y,
        head: [["No.", "Sasaran / Parameter", "Satuan", "Hasil Uji", "Metode", "Alat", "Nama Reagen"]],
        body: tableBody,
        theme: "grid",
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: [15, 118, 110],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { fontStyle: "bold", cellWidth: 45 },
          2: { halign: "center", cellWidth: 18 },
          3: { halign: "center", fontStyle: "bold", cellWidth: 24 },
          4: { halign: "center", cellWidth: 26 },
          5: { halign: "center", cellWidth: 26 },
          6: { cellWidth: "auto" },
        },
        didDrawPage: () => {
          doc.setFontSize(7);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(100, 116, 139);
          doc.text(
            `Dicetak pada: ${new Date().toLocaleString("id-ID")} - SmartPME Lembar Kerja Draft`,
            margin,
            doc.internal.pageSize.getHeight() - 6
          );
        },
      });

      const cleanLab = (selectedP?.labName || "peserta").replace(/[^a-zA-Z0-9]/g, "_");
      doc.save(`Draft_Hasil_PME_${cleanLab}_${selectedCycle.replace(/\s+/g, "_")}.pdf`);
      toast({
        title: "PDF Draft Berhasil Diunduh",
        description: "File PDF lembar draft hasil pemeriksaan telah tersimpan.",
      });
    } catch (err: any) {
      toast({
        title: "Gagal Mengunduh PDF",
        description: err?.message || "Terjadi kesalahan saat membuat file PDF.",
        variant: "destructive",
      });
    }
  };

  // Eksekusi pengiriman hasil saat klik "Kirim Sekarang"
  const executeSubmit = async () => {
    setConfirmDialogOpen(false);
    setSubmitting(true);
    try {
      const payload = {
        participantId: selectedParticipantId,
        cycle: selectedCycle.trim(),
        period: period.trim() || undefined,
        action: "SUBMIT_FINAL",
        isDraft: false,
        results: parameters
          .filter((p) => p.value.trim() !== "")
          .map((p) => ({
            parameterId: p.id,
            parameterName: p.name,
            unit: p.unit,
            value: parseFloat(p.value.replace(/,/g, ".")),
            methodCode: p.methodCode,
            instrumentCode: p.instrumentCode,
            reagentName: p.reagentName,
          })),
      };

      const res = await fetch("/api/pme-mgmt/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Hasil PME Berhasil Dikirim!",
          description: data.message || "Data telah tersimpan di sistem dan formulir terkunci.",
        });
        setIsSubmittedBefore(true);
        setIsDraft(false);
        setLastSubmittedAt(new Date().toISOString());
        if (data.submissionId) {
          setSubmissionId(data.submissionId);
        }
        setIsLocked(true);
        await loadParticipantParams();
      } else {
        const err = await res.json();
        toast({ title: "Gagal mengirim hasil", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal mengirim", description: "Terjadi kesalahan sistem.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const isSuperadmin = user?.role === "SUPERADMIN";
  const isDeadlineExpired = Boolean(deadlineInfo?.isExpired && !deadlineInfo?.allowExpiredInput);
  const isSubmissionClosed = Boolean(!deadlineInfo?.isSubmissionOpen && !deadlineInfo?.allowExpiredInput);
  const isTimeLocked = !isSuperadmin && (isDeadlineExpired || isSubmissionClosed);
  // Peserta non-admin terkunci jika sudah pernah submit final dan canEdit === false, atau jika waktu pengisian terkunci
  const isFormLocked = (!isSuperadmin && isSubmittedBefore && !canEdit) || isTimeLocked;
  // Status apakah submission ini terkunci secara umum di database
  const isSubmissionLocked = isSubmittedBefore && isLocked && !allowResubmit;

  const filledCount = parameters.filter((p) => p.value.trim() !== "").length;
  const selectedParticipant = participants.find((p) => p.id === selectedParticipantId);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Printable Sheet for window.print() (Only visible in Print mode) */}
      <div className="hidden print:block text-black bg-white p-6">
        {/* KOP Surat */}
        <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
          <div className="w-16 h-16 flex items-center justify-center shrink-0">
            {kopSurat?.logoKiri ? (
              <img src={kopSurat.logoKiri} alt="Logo Kiri" className="max-h-16 max-w-16 object-contain" />
            ) : null}
          </div>
          <div className="flex-1 text-center px-4 space-y-0.5">
            <h2 className="text-xs font-bold tracking-wider uppercase text-black">
              {kopSurat?.pemda || "Kementerian Kesehatan Republik Indonesia"}
            </h2>
            <h1 className="text-sm font-extrabold uppercase tracking-wide text-black">
              {kopSurat?.namaRumahSakit || "Balai Besar Laboratorium Kesehatan Masyarakat Palembang"}
            </h1>
            <p className="text-[10px] text-gray-700 leading-tight">
              {kopSurat?.alamatRumahSakit || "Jl. Inspektur Yazid No.2, Sekip Jaya, Palembang, Sumatera Selatan"}
            </p>
            <p className="text-[9.5px] text-gray-600">
              {kopSurat?.kontakRumahSakit || "Telp: (0711) 352 683 | Email: bblabkesmaspalembang@kemkes.go.id"}
            </p>
          </div>
          <div className="w-16 h-16 flex items-center justify-center shrink-0">
            {kopSurat?.logoKanan ? (
              <img src={kopSurat.logoKanan} alt="Logo Kanan" className="max-h-16 max-w-16 object-contain" />
            ) : null}
          </div>
        </div>

        {/* Judul Draft */}
        <div className="text-center mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-black">
            DRAFT LEMBAR HASIL PENGUJIAN PME
          </h2>
          <p className="text-[10px] text-gray-600">
            Lembar Verifikasi Internal Hasil Uji Peserta Sebelum Pengiriman Final
          </p>
        </div>

        {/* Identitas Laboratorium Peserta */}
        <div className="grid grid-cols-2 gap-2 text-xs border border-gray-400 p-3 rounded mb-4">
          <div>
            <span className="font-semibold">Nama Laboratorium:</span>{" "}
            {selectedParticipant?.labName || "-"}
          </div>
          <div>
            <span className="font-semibold">Kode Peserta:</span>{" "}
            {selectedParticipant?.participantCode || "-"}
          </div>
          <div>
            <span className="font-semibold">Siklus & Periode:</span>{" "}
            {selectedCycle} ({period})
          </div>
          <div>
            <span className="font-semibold">Waktu Cetak:</span>{" "}
            {new Date().toLocaleString("id-ID")}
          </div>
          <div className="col-span-2">
            <span className="font-semibold">Status Dokumen:</span>{" "}
            <span className="font-bold text-amber-700">
              {isSubmittedBefore ? "SUDAH DIKIRIM FINAL" : "DRAFT SEMENTARA (BELUM DIKIRIM FINAL)"}
            </span>
          </div>
        </div>

        {/* Tabel Parameter */}
        <table className="w-full text-left text-xs border border-gray-400 border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-400">
              <th className="p-2 border-r border-gray-400 text-center w-8">No</th>
              <th className="p-2 border-r border-gray-400">Sasaran / Parameter</th>
              <th className="p-2 border-r border-gray-400 text-center w-20">Satuan</th>
              <th className="p-2 border-r border-gray-400 text-center w-24">Hasil Uji</th>
              <th className="p-2 border-r border-gray-400 text-center w-28">Metode</th>
              <th className="p-2 border-r border-gray-400 text-center w-28">Alat</th>
              <th className="p-2">Nama Reagen</th>
            </tr>
          </thead>
          <tbody>
            {parameters.map((p, idx) => (
              <tr key={p.id} className="border-b border-gray-300">
                <td className="p-2 border-r border-gray-300 text-center">{idx + 1}</td>
                <td className="p-2 border-r border-gray-300 font-medium">{p.name}</td>
                <td className="p-2 border-r border-gray-300 text-center">{p.unit || "-"}</td>
                <td className="p-2 border-r border-gray-300 text-center font-bold font-mono">
                  {p.value || "(Belum diisi)"}
                </td>
                <td className="p-2 border-r border-gray-300 text-center">{p.methodCode || "-"}</td>
                <td className="p-2 border-r border-gray-300 text-center">{p.instrumentCode || "-"}</td>
                <td className="p-2">{p.reagentName || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 pt-3 border-t border-gray-300 text-[10px] text-gray-500 italic">
          * Lembar ini adalah DRAFT hasil pengujian untuk keperluan verifikasi internal laboratorium. Hasil ini belum sah sebagai pengiriman final sampai Anda menekan tombol &quot;Kirim Hasil PME&quot; pada aplikasi SmartPME.
        </div>
      </div>

      {/* Screen Interactive Container (Hidden during window.print) */}
      <div className="space-y-6 print:hidden">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
                <FilePenLine className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Input Hasil PME Peserta</h1>
                <p className="text-xs text-muted-foreground">
                  Pengisian hasil pengujian peserta (Hasil, Metode, Alat, dan Reagen) otomatis disesuaikan dengan paket yang dipilih
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user?.role === "SUPERADMIN" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("pme-reports")}
                className="text-xs border-teal-600/40 text-teal-800 dark:text-teal-300"
              >
                Lihat Laporan Hasil PME
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={loadParticipantParams} disabled={loading} className="text-xs">
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Segarkan
            </Button>
          </div>
        </div>

        {/* Real-time Countdown Deadline Timer Widget */}
        {deadlineInfo && (
          <PmeCountdownTimer
            deadline={deadlineInfo.effectiveDeadline || deadlineInfo.submissionDeadline}
            isSubmissionOpen={deadlineInfo.isSubmissionOpen}
            cycle={selectedCycle}
            period={period}
            variant="banner"
            onExpire={() => {
              loadParticipantParams();
            }}
          />
        )}

        {/* Participant & Cycle Selector Card */}
        <Card className="shadow-sm border">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-teal-600" />
                  <span>Pilih Laboratorium Peserta</span>
                </Label>
                <Select value={selectedParticipantId} onValueChange={handleSelectParticipant}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Pilih Laboratorium..." />
                  </SelectTrigger>
                  <SelectContent>
                    {participants.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.participantCode ? `[${p.participantCode}] ` : ""}
                        {p.labName} {p.status === "APPROVED" ? "✓ (Disetujui)" : p.status === "PENDING" ? "⏳ (Menunggu Persetujuan)" : "✗ (Ditolak)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                    <span>Siklus PME</span>
                  </Label>
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium bg-teal-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Otomatis
                  </span>
                </div>
                <Input
                  value={selectedCycle}
                  readOnly
                  disabled
                  tabIndex={-1}
                  placeholder="Contoh: Siklus 1 2026"
                  className="h-9 text-xs font-semibold bg-muted/60 text-foreground cursor-not-allowed border-dashed"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Periode / Tahap</Label>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Otomatis
                  </span>
                </div>
                <Input
                  value={period}
                  readOnly
                  disabled
                  tabIndex={-1}
                  placeholder="Contoh: Tahap 1"
                  className="h-9 text-xs font-semibold bg-muted/60 text-foreground cursor-not-allowed border-dashed"
                />
              </div>
            </div>

            {/* Active Registered Packages Indicator */}
            {registeredPackages.length > 0 && (
              <div className="mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-medium">Paket Terdaftar:</span>
                  {registeredPackages.map((pkg) => (
                    <Badge key={pkg.id} variant="outline" className="bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/30 text-xs">
                      {pkg.name} ({pkg.category})
                    </Badge>
                  ))}
                </div>

                {isSubmittedBefore ? (
                  <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      Sudah Terkirim {lastSubmittedAt ? `(${new Date(lastSubmittedAt).toLocaleDateString("id-ID")})` : ""}
                    </span>
                  </div>
                ) : isDraft ? (
                  <div className="flex items-center gap-1.5 text-amber-600 font-medium text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    <BookmarkCheck className="h-3.5 w-3.5" />
                    <span>Draft Tersimpan (Belum Dikirim Final)</span>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Case 0: Participant Is NOT Approved by Superadmin */}
        {isNotApproved && (
          <Card className="border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20">
            <CardContent className="p-8 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Pendaftaran Laboratorium Belum Disetujui
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                {approvalMessage ||
                  "Laboratorium ini berstatus 'Menunggu Persetujuan Superadmin'. Pengisian dan pengiriman hasil pengujian PME baru dapat dilakukan setelah pendaftaran disetujui oleh Superadmin."}
              </p>
              {user?.role === "SUPERADMIN" && (
                <div className="pt-2">
                  <Button
                    disabled={approvingParticipant}
                    onClick={() => handleApproveParticipant(selectedParticipantId)}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
                  >
                    {approvingParticipant ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-1.5 h-4 w-4" />
                    )}
                    Setujui Pendaftaran Laboratorium Ini
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Case 1: Participant Has NOT Registered Any Packages */}
        {!isNotApproved && hasNoPackages && (
          <Card className="border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20">
            <CardContent className="p-8 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Peserta Belum Memilih Paket PME pada {selectedCycle}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                Sistem secara otomatis membatasi formulir input hanya untuk parameter dari paket yang telah didaftarkan oleh peserta. Silakan pilih paket terlebih dahulu.
              </p>
              <div className="pt-2">
                <Button
                  onClick={() => navigate("pme-packages")}
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
                >
                  <PackageCheck className="mr-1.5 h-4 w-4" />
                  Pilih Paket PME Sekarang
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Case Time Locked (Expired / Closed) Banner */}
        {isTimeLocked && (
          <Card className="border-rose-500/40 bg-rose-500/5 dark:bg-rose-950/20 shadow-xs">
            <CardContent className="p-3.5">
              <div className="flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200">
                <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-600 shrink-0 mt-0.5">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                    <span>Pengisian Hasil PME Terkunci</span>
                    <Badge variant="destructive" className="text-[10px]">
                      {isSubmissionClosed ? "PENGISIAN DITUTUP" : "WAKTU HABIS"}
                    </Badge>
                  </h4>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    {isSubmissionClosed
                      ? "Pengisian hasil PME saat ini dinonaktifkan secara global oleh Superadmin."
                      : `Batas waktu pengisian hasil PME untuk siklus ini telah berakhir pada ${
                          deadlineInfo?.effectiveDeadline
                            ? new Date(deadlineInfo.effectiveDeadline).toLocaleString("id-ID")
                            : "-"
                        }.`}
                    {" Untuk dapat melakukan pengisian, silakan hubungi Superadmin agar diberikan perpanjangan batas waktu khusus."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Case 2: Form Input Hasil Parameters */}
        {!isNotApproved && !hasNoPackages && parameters.length > 0 && (
          <form onSubmit={handlePreSubmit} className="space-y-4">
            {/* Status Kunci Formulir / Edit Ulang Banner */}
            {isSubmittedBefore && (
              isSubmissionLocked ? (
                <Card className="border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20 shadow-xs">
                  <CardContent className="p-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 shrink-0 mt-0.5">
                          <Lock className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                            <span>Formulir Terkunci (Hasil Sudah Dikirim)</span>
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                              Terkunci
                            </Badge>
                          </h4>
                          <p className="text-muted-foreground text-[11px] mt-0.5">
                            Hasil pemeriksaan telah dikirim {lastSubmittedAt ? `pada ${new Date(lastSubmittedAt).toLocaleString("id-ID")}` : ""}.
                            {!isSuperadmin
                              ? " Hasil yang sudah dikirim tidak dapat diedit kembali. Untuk perbaikan hasil, hubungi Superadmin agar diberikan izin edit ulang."
                              : " Saat ini formulir terkunci untuk akun peserta tersebut."}
                          </p>
                        </div>
                      </div>
                      {isSuperadmin && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={togglingLock}
                          onClick={() => handleToggleLock(true)}
                          className="shrink-0 text-xs border-amber-600/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 h-8"
                        >
                          {togglingLock ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Unlock className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
                          )}
                          Buka Kunci Input (Izinkan Edit Ulang)
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20 shadow-xs">
                  <CardContent className="p-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 shrink-0 mt-0.5">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                            <span>Akses Edit Ulang Aktif</span>
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                              Terbuka
                            </Badge>
                          </h4>
                          <p className="text-muted-foreground text-[11px] mt-0.5">
                            {isSuperadmin
                              ? "Kunci formulir terbuka. Peserta atau Superadmin dapat mengubah data dan mengirim kembali."
                              : "Kunci formulir telah dibuka oleh Superadmin. Anda dapat memperbarui hasil pemeriksaan dan mengirimkannya kembali."}
                          </p>
                        </div>
                      </div>
                      {isSuperadmin && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={togglingLock}
                          onClick={() => handleToggleLock(false)}
                          className="shrink-0 text-xs border-muted text-muted-foreground hover:bg-muted h-8"
                        >
                          {togglingLock ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Lock className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Kunci Kembali Formulir
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            )}

            {/* Quick Helper Banner */}
            <Card className="shadow-xs border bg-muted/20">
              <CardContent className="p-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="font-semibold text-foreground">Penerapan Seragam:</span>
                    <span className="hidden sm:inline">Terapkan kode alat/metode/reagen dari Master Data ke semua parameter:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Batch Metode with Dropdown */}
                    <div className="relative flex items-center">
                      <Input
                        list="master-methods-list"
                        placeholder="Kode / Nama Metode"
                        value={batchMethod}
                        disabled={isFormLocked}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setBatchMethod(e.target.value)}
                        className={`h-7 w-44 pr-7 text-[11px] font-mono ${isFormLocked ? "cursor-not-allowed opacity-60" : ""}`}
                      />
                      {!isFormLocked && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              tabIndex={-1}
                              title="Pilih Metode dari Master Data"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-80 max-h-64 overflow-y-auto p-1 text-xs z-50">
                            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-b mb-1">
                              Pilihan Master Metode ({masterMethods.length})
                            </div>
                            {masterMethods.length === 0 ? (
                              <div className="p-2 text-center text-muted-foreground text-xs">Belum ada master data metode</div>
                            ) : (
                              masterMethods.map((m) => (
                                <DropdownMenuItem
                                  key={m.id}
                                  onClick={() => setBatchMethod(`${m.code} - ${m.name}`)}
                                  className="flex items-start gap-2 py-1.5 px-2 cursor-pointer text-xs"
                                >
                                  <span className="font-bold text-teal-700 dark:text-teal-400 shrink-0 font-mono text-[10px] bg-teal-500/10 px-1 py-0.5 rounded">
                                    {m.code}
                                  </span>
                                  <span className="text-foreground leading-snug">{m.name}</span>
                                </DropdownMenuItem>
                              ))
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {/* Batch Alat with Dropdown */}
                    <div className="relative flex items-center">
                      <Input
                        list="master-instruments-list"
                        placeholder="Kode / Nama Alat"
                        value={batchInstrument}
                        disabled={isFormLocked}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setBatchInstrument(e.target.value)}
                        className={`h-7 w-44 pr-7 text-[11px] font-mono ${isFormLocked ? "cursor-not-allowed opacity-60" : ""}`}
                      />
                      {!isFormLocked && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              tabIndex={-1}
                              title="Pilih Alat dari Master Data"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-80 max-h-64 overflow-y-auto p-1 text-xs z-50">
                            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-b mb-1">
                              Pilihan Master Alat ({masterInstruments.length})
                            </div>
                            {masterInstruments.length === 0 ? (
                              <div className="p-2 text-center text-muted-foreground text-xs">Belum ada master data alat</div>
                            ) : (
                              masterInstruments.map((inst) => (
                                <DropdownMenuItem
                                  key={inst.id}
                                  onClick={() => setBatchInstrument(`${inst.code} - ${inst.name}`)}
                                  className="flex items-start gap-2 py-1.5 px-2 cursor-pointer text-xs"
                                >
                                  <span className="font-bold text-teal-700 dark:text-teal-400 shrink-0 font-mono text-[10px] bg-teal-500/10 px-1 py-0.5 rounded">
                                    {inst.code}
                                  </span>
                                  <span className="text-foreground leading-snug">{inst.name}</span>
                                </DropdownMenuItem>
                              ))
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {/* Batch Reagen with Dropdown */}
                    <div className="relative flex items-center">
                      <Input
                        list="master-reagents-list"
                        placeholder="Nama Reagen"
                        value={batchReagent}
                        disabled={isFormLocked}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setBatchReagent(e.target.value)}
                        className={`h-7 w-44 pr-7 text-[11px] ${isFormLocked ? "cursor-not-allowed opacity-60" : ""}`}
                      />
                      {!isFormLocked && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              tabIndex={-1}
                              title="Pilih Reagen dari Master Data"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-80 max-h-64 overflow-y-auto p-1 text-xs z-50">
                            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-b mb-1">
                              Pilihan Master Reagen ({masterReagents.length})
                            </div>
                            {masterReagents.length === 0 ? (
                              <div className="p-2 text-center text-muted-foreground text-xs">Belum ada master data reagen</div>
                            ) : (
                              masterReagents.map((r) => (
                                <DropdownMenuItem
                                  key={r.id}
                                  onClick={() => setBatchReagent(r.name)}
                                  className="flex items-start gap-2 py-1.5 px-2 cursor-pointer text-xs"
                                >
                                  <span className="font-bold text-teal-700 dark:text-teal-400 shrink-0 font-mono text-[10px] bg-teal-500/10 px-1 py-0.5 rounded">
                                    {r.code}
                                  </span>
                                  <span className="text-foreground leading-snug">{r.name}</span>
                                </DropdownMenuItem>
                              ))
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isFormLocked}
                      onClick={handleApplyBatch}
                      className="h-7 text-[11px]"
                    >
                      Terapkan
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Main Input Table */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Tabel Input Hasil Pemeriksaan</CardTitle>
                  <CardDescription className="text-xs">
                    Masukkan nilai numerik hasil uji laboratorium, kode metode, kode alat, dan nama reagen (dapat dipilih lewat dropdown atau ketik pencarian)
                  </CardDescription>
                </div>
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-full font-mono">
                  {filledCount} / {parameters.length} Parameter Terisi
                </span>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/60 text-muted-foreground font-semibold">
                      <tr>
                        <th className="p-2.5 w-12 text-center">No.</th>
                        <th className="p-2.5 min-w-[160px]">Sasaran / Parameter</th>
                        <th className="p-2.5 w-24">Satuan</th>
                        <th className="p-2.5 w-36 text-center">
                          Hasil Uji <span className="text-red-500">*</span>
                        </th>
                        <th className="p-2.5 min-w-[190px] text-center">Kode / Nama Metode</th>
                        <th className="p-2.5 min-w-[190px] text-center">Kode / Nama Alat</th>
                        <th className="p-2.5 min-w-[200px]">Nama Reagen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parameters.map((param, idx) => (
                        <tr key={param.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-2.5 text-center text-muted-foreground font-mono">{idx + 1}</td>
                          <td className="p-2.5">
                            <p className="font-semibold text-foreground">{param.name}</p>
                            <span className="text-[10px] text-muted-foreground">{param.packageName}</span>
                          </td>
                          <td className="p-2.5 font-mono text-muted-foreground">
                            {param.unit ? (
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {param.unit}
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </td>
                          {/* Kolom Hasil */}
                          <td className="p-2 text-center">
                            <Input
                              type="text"
                              placeholder="0.00"
                              value={param.value}
                              disabled={isFormLocked}
                              onChange={(e) => handleRowChange(idx, "value", e.target.value)}
                              className={`h-8 text-center font-mono font-bold text-xs ${
                                isFormLocked
                                  ? "bg-muted/60 text-muted-foreground cursor-not-allowed border-dashed"
                                  : "bg-background focus:ring-1 focus:ring-teal-600"
                              }`}
                            />
                          </td>
                          {/* Kolom Metode with Datalist Autocomplete & Direct Dropdown Menu */}
                          <td className="p-2">
                            <div className="relative flex items-center w-full">
                              <Input
                                list="master-methods-list"
                                placeholder={param.defaultMethodCode || "Pilih / Cari Metode..."}
                                value={param.methodCode}
                                disabled={isFormLocked}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleRowChange(idx, "methodCode", e.target.value)}
                                className={`h-8 pr-7 text-xs ${
                                  isFormLocked
                                    ? "bg-muted/60 text-muted-foreground cursor-not-allowed border-dashed"
                                    : "bg-background"
                                }`}
                              />
                              {!isFormLocked && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      title="Buka Pilihan Metode"
                                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-80 max-h-64 overflow-y-auto p-1 text-xs z-50">
                                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-b mb-1">
                                      Pilihan Master Metode ({masterMethods.length})
                                    </div>
                                    {masterMethods.length === 0 ? (
                                      <div className="p-2 text-center text-muted-foreground text-xs">Belum ada master data metode</div>
                                    ) : (
                                      masterMethods.map((m) => (
                                        <DropdownMenuItem
                                          key={m.id}
                                          onClick={() => handleRowChange(idx, "methodCode", `${m.code} - ${m.name}`)}
                                          className="flex items-start gap-2 py-1.5 px-2 cursor-pointer text-xs hover:bg-teal-50 dark:hover:bg-teal-950/40"
                                        >
                                          <span className="font-bold text-teal-700 dark:text-teal-400 shrink-0 font-mono text-[10px] bg-teal-500/10 px-1 py-0.5 rounded">
                                            {m.code}
                                          </span>
                                          <span className="text-foreground leading-snug">{m.name}</span>
                                        </DropdownMenuItem>
                                      ))
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </td>
                          {/* Kolom Alat with Datalist Autocomplete & Direct Dropdown Menu */}
                          <td className="p-2">
                            <div className="relative flex items-center w-full">
                              <Input
                                list="master-instruments-list"
                                placeholder={param.defaultInstrumentCode || "Pilih / Cari Alat..."}
                                value={param.instrumentCode}
                                disabled={isFormLocked}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleRowChange(idx, "instrumentCode", e.target.value)}
                                className={`h-8 pr-7 text-xs ${
                                  isFormLocked
                                    ? "bg-muted/60 text-muted-foreground cursor-not-allowed border-dashed"
                                    : "bg-background"
                                }`}
                              />
                              {!isFormLocked && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      title="Buka Pilihan Alat"
                                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-80 max-h-64 overflow-y-auto p-1 text-xs z-50">
                                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-b mb-1">
                                      Pilihan Master Alat ({masterInstruments.length})
                                    </div>
                                    {masterInstruments.length === 0 ? (
                                      <div className="p-2 text-center text-muted-foreground text-xs">Belum ada master data alat</div>
                                    ) : (
                                      masterInstruments.map((inst) => (
                                        <DropdownMenuItem
                                          key={inst.id}
                                          onClick={() => handleRowChange(idx, "instrumentCode", `${inst.code} - ${inst.name}`)}
                                          className="flex items-start gap-2 py-1.5 px-2 cursor-pointer text-xs hover:bg-teal-50 dark:hover:bg-teal-950/40"
                                        >
                                          <span className="font-bold text-teal-700 dark:text-teal-400 shrink-0 font-mono text-[10px] bg-teal-500/10 px-1 py-0.5 rounded">
                                            {inst.code}
                                          </span>
                                          <span className="text-foreground leading-snug">{inst.name}</span>
                                        </DropdownMenuItem>
                                      ))
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </td>
                          {/* Kolom Nama Reagen with Datalist Autocomplete & Direct Dropdown Menu */}
                          <td className="p-2">
                            <div className="relative flex items-center w-full">
                              <Input
                                list="master-reagents-list"
                                placeholder="Pilih / Cari Nama Reagen..."
                                value={param.reagentName}
                                disabled={isFormLocked}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleRowChange(idx, "reagentName", e.target.value)}
                                className={`h-8 pr-7 text-xs ${
                                  isFormLocked
                                    ? "bg-muted/60 text-muted-foreground cursor-not-allowed border-dashed"
                                    : "bg-background"
                                }`}
                              />
                              {!isFormLocked && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      title="Buka Pilihan Reagen"
                                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-80 max-h-64 overflow-y-auto p-1 text-xs z-50">
                                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-b mb-1">
                                      Pilihan Master Reagen ({masterReagents.length})
                                    </div>
                                    {masterReagents.length === 0 ? (
                                      <div className="p-2 text-center text-muted-foreground text-xs">Belum ada master data reagen</div>
                                    ) : (
                                      masterReagents.map((r) => (
                                        <DropdownMenuItem
                                          key={r.id}
                                          onClick={() => handleRowChange(idx, "reagentName", r.name)}
                                          className="flex items-start gap-2 py-1.5 px-2 cursor-pointer text-xs hover:bg-teal-50 dark:hover:bg-teal-950/40"
                                        >
                                          <span className="font-bold text-teal-700 dark:text-teal-400 shrink-0 font-mono text-[10px] bg-teal-500/10 px-1 py-0.5 rounded">
                                            {r.code}
                                          </span>
                                          <span className="text-foreground leading-snug">{r.name}</span>
                                        </DropdownMenuItem>
                                      ))
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Action Footer: [Cetak / Print Draft] [Unduh PDF Draft] [Simpan Draft Hasil] [Kirim Hasil PME] */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pt-2">
              <div className="text-xs text-muted-foreground">
                {isFormLocked ? (
                  isTimeLocked ? (
                    <span className="text-rose-600 dark:text-rose-400 font-medium">
                      Batas waktu pengisian PME telah berakhir atau sedang dinonaktifkan. Hubungi Superadmin untuk mengajukan perpanjangan waktu pengisian khusus.
                    </span>
                  ) : (
                    <span>
                      Formulir ini dalam status terkunci. Untuk perbaikan hasil, hubungi Superadmin agar diberikan izin edit ulang.
                    </span>
                  )
                ) : isDraft ? (
                  <span className="text-amber-700 dark:text-amber-400 font-medium">
                    Data tersimpan sebagai DRAFT sementara. Seluruh data masih dapat diubah dan pastikan klik &quot;Kirim Hasil PME&quot; untuk pengiriman final.
                  </span>
                ) : (
                  <span>
                    Pastikan seluruh nilai hasil pemeriksaan telah diperiksa dengan teliti sebelum menekan tombol Kirim.
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* 1. Tombol Cetak / Print Draft */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrintDraft}
                  className="text-xs h-9 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Printer className="mr-1.5 h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                  Cetak / Print Draft
                </Button>

                {/* 2. Tombol Unduh PDF Draft */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPdf}
                  className="text-xs h-9 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Unduh PDF Draft
                </Button>

                {/* 3. Tombol Simpan Draft Hasil */}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isFormLocked || savingDraft || filledCount === 0}
                  onClick={handleSaveDraft}
                  className="text-xs h-9 bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-500/30"
                >
                  {savingDraft ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  )}
                  Simpan Draft Hasil
                </Button>

                {/* 4. Tombol Kirim Hasil PME */}
                {isFormLocked ? (
                  <Button
                    type="button"
                    disabled
                    className="bg-muted text-muted-foreground cursor-not-allowed px-5 text-xs h-9 shadow-xs border"
                  >
                    <Lock className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
                    {isTimeLocked ? "Waktu Pengisian Berakhir" : "Hasil Sudah Dikirim (Terkunci)"}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={submitting || filledCount === 0}
                    className="bg-teal-700 hover:bg-teal-800 text-white px-5 text-xs h-9 shadow-sm"
                  >
                    {submitting ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Kirim Hasil PME
                  </Button>
                )}
              </div>
            </div>
          </form>
        )}

        {/* Confirmation Dialog Before Submitting */}
        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <AlertDialogTitle className="text-sm font-bold">
                  Konfirmasi Pengiriman Hasil PME
                </AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-xs text-foreground/80 leading-relaxed pt-2">
                hasil yang sudah dikirim tidak dapat dilakukan edit hasil kembali, teliti kembali hasil input anda
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0 mt-3">
              <AlertDialogCancel
                disabled={submitting}
                className="text-xs h-8 border-muted-foreground/30 hover:bg-muted"
              >
                Batal Kirim
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={submitting}
                onClick={(e) => {
                  e.preventDefault();
                  executeSubmit();
                }}
                className="text-xs h-8 bg-teal-700 hover:bg-teal-800 text-white"
              >
                {submitting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                )}
                Kirim Sekarang
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* HTML5 Datalists for Master Data Autocomplete & Typing Search */}
        <datalist id="master-methods-list">
          {masterMethods.map((m) => (
            <option key={m.id} value={`${m.code} - ${m.name}`}>
              {m.name}
            </option>
          ))}
          {masterMethods.map((m) => (
            <option key={`code-${m.id}`} value={m.code}>
              {m.name}
            </option>
          ))}
        </datalist>

        <datalist id="master-instruments-list">
          {masterInstruments.map((inst) => (
            <option key={inst.id} value={`${inst.code} - ${inst.name}`}>
              {inst.name}
            </option>
          ))}
          {masterInstruments.map((inst) => (
            <option key={`code-${inst.id}`} value={inst.code}>
              {inst.name}
            </option>
          ))}
        </datalist>

        <datalist id="master-reagents-list">
          {masterReagents.map((r) => (
            <option key={r.id} value={r.name}>
              {r.code} - {r.name}
            </option>
          ))}
          {masterReagents.map((r) => (
            <option key={`combo-${r.id}`} value={`${r.code} - ${r.name}`}>
              {r.name}
            </option>
          ))}
        </datalist>
      </div>
    </div>
  );
}
