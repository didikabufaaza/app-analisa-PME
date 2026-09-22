"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Database,
  FlaskConical,
  Wrench,
  Droplets,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Lock,
} from "lucide-react";

interface MasterItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function MasterDataView() {
  const { user, viewAsTenantId } = useAppStore();
  const { toast } = useToast();

  const isSuperadmin = user?.role === "SUPERADMIN";

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"INSTRUMENT" | "METHOD" | "REAGENT">("INSTRUMENT");

  const [instruments, setInstruments] = useState<MasterItem[]>([]);
  const [methods, setMethods] = useState<MasterItem[]>([]);
  const [reagents, setReagents] = useState<MasterItem[]>([]);

  const [nextCodes, setNextCodes] = useState<{
    INSTRUMENT: string;
    METHOD: string;
    REAGENT: string;
  }>({
    INSTRUMENT: "ALT-001",
    METHOD: "MTD-001",
    REAGENT: "RGN-001",
  });

  const [search, setSearch] = useState("");

  // Modal Create / Edit State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Modal Delete State
  const [deleteTarget, setDeleteTarget] = useState<MasterItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pme-mgmt/master", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        setInstruments(data.instruments || []);
        setMethods(data.methods || []);
        setReagents(data.reagents || []);
        if (data.nextCodes) {
          setNextCodes(data.nextCodes);
        }
      } else {
        const err = await res.json();
        toast({ title: "Gagal memuat master data", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Gagal mengambil master data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [viewAsTenantId]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormName("");
    setFormCode(nextCodes[activeTab] || "");
    setFormDescription("");
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: MasterItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCode(item.code);
    setFormDescription(item.description || "");
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast({ title: "Validasi Gagal", description: "Nama wajib diisi.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        action: editingItem ? "UPDATE" : "CREATE",
        type: activeTab,
        id: editingItem?.id,
        code: formCode.trim() || undefined,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
      };

      const res = await fetch("/api/pme-mgmt/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: editingItem ? "Berhasil Diperbarui" : "Berhasil Ditambahkan",
          description: data.message,
        });
        setDialogOpen(false);
        loadData();
      } else {
        const err = await res.json();
        toast({ title: "Gagal menyimpan", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Terjadi kesalahan sistem.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/pme-mgmt/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "DELETE",
          type: activeTab,
          id: deleteTarget.id,
        }),
      });

      if (res.ok) {
        toast({ title: "Berhasil Dihapus", description: "Master data telah dihapus." });
        setDeleteTarget(null);
        loadData();
      } else {
        const err = await res.json();
        toast({ title: "Gagal menghapus", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal menghapus", description: "Terjadi kesalahan jaringan.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (!isSuperadmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Akses Khusus Superadmin</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Menu Master Data hanya dapat diakses dan dikelola oleh akun dengan hak akses Superadmin.
        </p>
      </div>
    );
  }

  // Filtered lists based on search
  const currentList =
    activeTab === "INSTRUMENT" ? instruments : activeTab === "METHOD" ? methods : reagents;

  const filteredList = currentList.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase()))
  );

  const getTabTitle = () => {
    if (activeTab === "INSTRUMENT") return "Alat Laboratorium";
    if (activeTab === "METHOD") return "Metode Pemeriksaan";
    return "Reagen Pemeriksaan";
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Master Data PME</h1>
                <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30 text-[10px] font-bold">
                  SUPERADMIN
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kelola master Alat, Metode, dan Reagen PME. Data ini otomatis muncul sebagai pilihan dropdown dan pencarian di formulir Input Hasil PME peserta.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="text-xs">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Segarkan
          </Button>
          <Button onClick={handleOpenCreate} size="sm" className="bg-purple-700 hover:bg-purple-800 text-white text-xs">
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah {getTabTitle()} Baru
          </Button>
        </div>
      </div>

      {/* Info Card Banner */}
      <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-purple-900 dark:text-purple-200">
              Otomatisasi Kode & Sinkronisasi Input Peserta:
            </span>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">
              Kode Alat (<strong>ALT-xxx</strong>), Metode (<strong>MTD-xxx</strong>), dan Reagen (<strong>RGN-xxx</strong>) dibuat secara otomatis berurutan oleh sistem. Peserta dapat langsung memilih atau mengetik pencarian pada formulir Input Hasil PME.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs & Content */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val as any);
          setSearch("");
        }}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="bg-muted/70 p-1">
            <TabsTrigger value="INSTRUMENT" className="text-xs flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              <span>1. Master Alat ({instruments.length})</span>
            </TabsTrigger>
            <TabsTrigger value="METHOD" className="text-xs flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              <span>2. Master Metode ({methods.length})</span>
            </TabsTrigger>
            <TabsTrigger value="REAGENT" className="text-xs flex items-center gap-1.5">
              <Droplets className="h-3.5 w-3.5" />
              <span>3. Master Reagen ({reagents.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={`Cari ${getTabTitle().toLowerCase()} atau kode...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        {/* TAB CONTENTS (Rendered into one unified dynamic table) */}
        {["INSTRUMENT", "METHOD", "REAGENT"].map((tabKey) => (
          <TabsContent key={tabKey} value={tabKey} className="space-y-4 m-0">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {tabKey === "INSTRUMENT" && <Wrench className="h-4 w-4 text-blue-600" />}
                    {tabKey === "METHOD" && <FlaskConical className="h-4 w-4 text-teal-600" />}
                    {tabKey === "REAGENT" && <Droplets className="h-4 w-4 text-purple-600" />}
                    <span>Daftar {getTabTitle()}</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {filteredList.length} data ditemukan
                  </CardDescription>
                </div>

                <div className="text-xs text-muted-foreground font-mono">
                  Kode Berikutnya:{" "}
                  <span className="font-bold text-purple-600 dark:text-purple-400">
                    {nextCodes[tabKey as keyof typeof nextCodes]}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50 text-muted-foreground font-semibold">
                      <tr>
                        <th className="p-3 w-12 text-center">No.</th>
                        <th className="p-3 w-28">Kode Sistem</th>
                        <th className="p-3 min-w-[220px]">Nama {getTabTitle()}</th>
                        <th className="p-3 min-w-[180px]">Keterangan</th>
                        <th className="p-3 w-32">Dibuat Pada</th>
                        <th className="p-3 w-20 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                            Memuat data master...
                          </td>
                        </tr>
                      ) : filteredList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                            {search
                              ? "Tidak ditemukan data yang sesuai dengan pencarian."
                              : "Belum ada master data. Klik tombol di atas untuk menambahkan data baru."}
                          </td>
                        </tr>
                      ) : (
                        filteredList.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                            <td className="p-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="p-3">
                              <Badge
                                variant="outline"
                                className={`font-mono font-bold text-[11px] ${
                                  tabKey === "INSTRUMENT"
                                    ? "bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/30"
                                    : tabKey === "METHOD"
                                    ? "bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/30"
                                    : "bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-500/30"
                                }`}
                              >
                                {item.code}
                              </Badge>
                            </td>
                            <td className="p-3 font-semibold text-foreground">{item.name}</td>
                            <td className="p-3 text-muted-foreground">{item.description || "-"}</td>
                            <td className="p-3 text-muted-foreground font-mono text-[11px]">
                              {new Date(item.createdAt).toLocaleDateString("id-ID")}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Edit Data"
                                  onClick={() => handleOpenEdit(item)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Hapus Data"
                                  onClick={() => setDeleteTarget(item)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
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
          </TabsContent>
        ))}
      </Tabs>

      {/* Dialog Form Tambah / Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                {editingItem ? `Edit ${getTabTitle()}` : `Tambah ${getTabTitle()} Baru`}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {editingItem
                  ? "Perbarui informasi master data di bawah."
                  : "Data yang Anda tambahkan akan otomatis menjadi pilihan dropdown di menu Input Hasil PME."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Kolom Kode Otomatis */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Kode {getTabTitle()}
                  </Label>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium bg-purple-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Otomatis oleh Sistem
                  </span>
                </div>
                <Input
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="Kode sistem otomatis"
                  className="h-9 text-xs font-mono font-bold bg-muted/50 border-dashed"
                />
                <p className="text-[10px] text-muted-foreground">
                  Sistem otomatis memberikan kode berurutan (cth: {nextCodes[activeTab]}).
                </p>
              </div>

              {/* Kolom Nama */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Nama {getTabTitle()} <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={`Contoh: ${
                    activeTab === "INSTRUMENT"
                      ? "Mindray BS-240"
                      : activeTab === "METHOD"
                      ? "GOD-PAP (Glukosa Oksidase)"
                      : "DiaSys Diagnostic"
                  }`}
                  required
                  className="h-9 text-xs"
                />
              </div>

              {/* Kolom Keterangan */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Keterangan / Spesifikasi (Opsional)</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Catatan atau spesifikasi teknis tambahan..."
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-purple-700 hover:bg-purple-800 text-white text-xs"
              >
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Simpan Data
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Hapus */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold text-red-600">
              Konfirmasi Hapus Data
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              Apakah Anda yakin ingin menghapus {getTabTitle()}:{" "}
              <strong className="text-foreground">{deleteTarget?.name}</strong> ({deleteTarget?.code})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleting} className="text-xs">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Ya, Hapus Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
