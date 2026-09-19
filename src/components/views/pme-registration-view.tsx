"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Trash2,
  PackageCheck,
  FilePenLine,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface ParticipantItem {
  id: string;
  participantCode: string | null;
  labName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  contactPerson: string | null;
  createdAt: string;
  packageRegistrations?: {
    id: string;
    cycle: string;
    package: { name: string; category: string };
  }[];
  _count?: { submissions: number };
}

export function PmeRegistrationView() {
  const { user, navigate, viewAsTenantId } = useAppStore();
  const { toast } = useToast();

  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ParticipantItem | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formLabName, setFormLabName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formContactPerson, setFormContactPerson] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<ParticipantItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pme-mgmt/participants", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
      } else {
        const err = await res.json();
        toast({ title: "Gagal memuat peserta", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Gagal mengambil data peserta", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipants();
  }, [viewAsTenantId]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormCode("");
    setFormLabName("");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormContactPerson("");
    setDialogOpen(true);
  };

  const handleOpenEdit = (p: ParticipantItem) => {
    setEditingItem(p);
    setFormCode(p.participantCode || "");
    setFormLabName(p.labName);
    setFormPhone(p.phone || "");
    setFormEmail(p.email || "");
    setFormAddress(p.address || "");
    setFormContactPerson(p.contactPerson || "");
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabName.trim()) {
      toast({ title: "Validasi Gagal", description: "Nama Laboratorium Peserta wajib diisi.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/pme-mgmt/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          id: editingItem?.id,
          participantCode: formCode.trim() || undefined,
          labName: formLabName.trim(),
          phone: formPhone.trim() || undefined,
          email: formEmail.trim() || undefined,
          address: formAddress.trim() || undefined,
          contactPerson: formContactPerson.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast({
          title: editingItem ? "Peserta Diperbarui" : "Peserta Didaftarkan",
          description: `Laboratorium ${formLabName} berhasil disimpan.`,
        });
        setDialogOpen(false);
        fetchParticipants();
      } else {
        const err = await res.json();
        toast({ title: "Gagal menyimpan", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal menyimpan", description: "Terjadi kesalahan sistem.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/pme-mgmt/participants?id=${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) {
        toast({ title: "Peserta Dihapus", description: `Data ${deleteTarget.labName} telah dihapus.` });
        setDeleteTarget(null);
        fetchParticipants();
      } else {
        const err = await res.json();
        toast({ title: "Gagal menghapus", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal menghapus", description: "Terjadi kesalahan sistem.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = participants.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.labName.toLowerCase().includes(q) ||
      (p.participantCode && p.participantCode.toLowerCase().includes(q)) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.address && p.address.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
              <UserPlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Pendaftaran Peserta PME</h1>
              <p className="text-xs text-muted-foreground">
                Pendaftaran data identitas laboratorium peserta Program Pemantapan Mutu Eksternal
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchParticipants} disabled={loading} className="text-xs">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Muat Ulang
          </Button>
          <Button onClick={handleOpenCreate} size="sm" className="bg-teal-700 hover:bg-teal-800 text-white text-xs">
            <UserPlus className="mr-1.5 h-4 w-4" />
            Daftar Peserta Baru
          </Button>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Laboratorium Peserta</p>
              <h3 className="text-2xl font-bold mt-1 text-foreground">{participants.length}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-700 dark:text-teal-400">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Peserta Sudah Memilih Paket</p>
              <h3 className="text-2xl font-bold mt-1 text-foreground">
                {participants.filter((p) => (p.packageRegistrations?.length || 0) > 0).length}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-700 dark:text-blue-400">
              <PackageCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Peserta Sudah Kirim Hasil</p>
              <h3 className="text-2xl font-bold mt-1 text-foreground">
                {participants.filter((p) => (p._count?.submissions || 0) > 0).length}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <FilePenLine className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Daftar Laboratorium Peserta Terdaftar</CardTitle>
              <CardDescription className="text-xs">
                Informasi laboratorium yang telah terdaftar dalam sistem PME
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari lab, kode, no hp, alamat..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/50 text-muted-foreground font-medium">
                <tr>
                  <th className="p-3 w-12 text-center">No.</th>
                  <th className="p-3 w-28">Kode Peserta</th>
                  <th className="p-3 min-w-[180px]">Nama Laboratorium</th>
                  <th className="p-3 min-w-[140px]">Kontak & HP</th>
                  <th className="p-3 min-w-[150px]">Email</th>
                  <th className="p-3 min-w-[200px]">Alamat Instansi</th>
                  <th className="p-3 min-w-[140px]">Paket Terdaftar</th>
                  <th className="p-3 w-32 text-center">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                        <span>Memuat data peserta...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground italic">
                      {search ? "Tidak ditemukan peserta yang sesuai pencarian." : "Belum ada peserta PME yang didaftarkan. Klik tombol di atas untuk mendaftarkan peserta baru."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="p-3">
                        <span className="font-mono font-semibold text-teal-700 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded text-[11px]">
                          {item.participantCode || "-"}
                        </span>
                      </td>
                      <td className="p-3">
                        <p className="font-semibold text-foreground">{item.labName}</p>
                        {item.contactPerson && (
                          <p className="text-[10px] text-muted-foreground">PJ: {item.contactPerson}</p>
                        )}
                      </td>
                      <td className="p-3">
                        {item.phone ? (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3 text-teal-600" />
                            <span className="font-mono">{item.phone}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {item.email ? (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3 text-blue-600" />
                            <span>{item.email}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">-</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground leading-relaxed">
                        {item.address ? (
                          <div className="flex items-start gap-1">
                            <MapPin className="h-3 w-3 text-rose-500 mt-0.5 shrink-0" />
                            <span>{item.address}</span>
                          </div>
                        ) : (
                          <span className="italic">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {item.packageRegistrations && item.packageRegistrations.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.packageRegistrations.map((pr) => (
                              <Badge key={pr.id} variant="outline" className="text-[10px] bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/20">
                                {pr.package.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                            Belum Pilih Paket
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit Data Peserta"
                            onClick={() => handleOpenEdit(item)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Pilih Paket PME"
                            onClick={() => navigate("pme-packages")}
                            className="h-7 w-7 p-0 text-teal-600 hover:text-teal-700"
                          >
                            <PackageCheck className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Input Hasil PME"
                            onClick={() => navigate("pme-input")}
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700"
                          >
                            <FilePenLine className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Hapus Peserta"
                            onClick={() => setDeleteTarget(item)}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Pendaftaran / Edit Peserta */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Data Peserta PME" : "Pendaftaran Peserta PME Baru"}</DialogTitle>
            <DialogDescription className="text-xs">
              Lengkapi informasi laboratorium peserta PME di bawah ini.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3.5 text-xs py-2">
            <div className="space-y-1">
              <Label className="text-xs">Kode Peserta (Opsional / Otomatis jika kosong)</Label>
              <Input
                placeholder="Contoh: 07-01-02835 atau LAB-001"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Nama Laboratorium Peserta <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Contoh: RSUD OKU Timur / Labkesda Kota"
                value={formLabName}
                onChange={(e) => setFormLabName(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">No. Handphone / WhatsApp</Label>
                <Input
                  placeholder="0811..."
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Penanggung Jawab (PJ)</Label>
                <Input
                  placeholder="Nama PJ Lab"
                  value={formContactPerson}
                  onChange={(e) => setFormContactPerson(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Alamat Email Resmi</Label>
              <Input
                type="email"
                placeholder="laboratorium@instansi.go.id"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Alamat Lengkap Instansi</Label>
              <Textarea
                placeholder="Jln. Raya Belitang-Rasuan No.1 Sumatera Selatan"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="bg-teal-700 hover:bg-teal-800 text-white">
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {editingItem ? "Simpan Perubahan" : "Daftarkan Peserta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog Konfirmasi Hapus */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Peserta?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              Apakah Anda yakin ingin menghapus data laboratorium{" "}
              <strong>{deleteTarget?.labName}</strong>? Seluruh riwayat pendaftaran paket dan hasil PME yang terkait dengan peserta ini akan terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white text-xs"
            >
              {deleting ? "Menghapus..." : "Hapus Permanen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
