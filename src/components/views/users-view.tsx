"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ManagedUser, TenantOption } from "@/types/pme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
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
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Check,
  CheckCircle,
  Building2,
  KeyRound,
  Lock,
} from "lucide-react";

const ALL_MENUS: { key: string; label: string; desc: string; superAdminOnly?: boolean }[] = [
  { key: "dashboard", label: "Dashboard", desc: "Ringkasan KPI & grafik distribusi Z-score" },
  { key: "sessions", label: "Sesi PME", desc: "Daftar berkas PME, upload PDF, dan detail hasil" },
  { key: "reports", label: "Laporan Lengkap", desc: "Tabel rekapitulasi mutu dan ekspor PDF/Excel Model 1 & 2" },
  { key: "review", label: "Review Center", desc: "Verifikasi manual parameter dengan status review" },
  { key: "capa", label: "CAPA", desc: "Pengelolaan tiket tindakan perbaikan & pencegahan" },
  { key: "settings", label: "Pengaturan", desc: "Konfigurasi batas aturan Z-score dan kapasitas sistem" },
  { key: "audit", label: "Log Audit", desc: "Rekaman jejak aktivitas seluruh pengguna" },
  { key: "users", label: "Pengaturan User", desc: "Manajemen akun pengguna dan hak akses (Superadmin)", superAdminOnly: true },
];

const DEFAULT_MENUS_BY_ROLE: Record<string, string[]> = {
  SUPERADMIN: ["dashboard", "sessions", "reports", "review", "capa", "settings", "audit", "users"],
  ADMIN: ["dashboard", "sessions", "reports", "review", "capa", "settings", "audit"],
  SUPERVISOR: ["dashboard", "sessions", "reports", "review", "capa"],
  ANALYST: ["dashboard", "sessions", "reports", "review"],
};

export function UsersView() {
  const { user } = useAppStore();
  const { toast } = useToast();

  const [usersList, setUsersList] = useState<ManagedUser[]>([]);
  const [tenantsList, setTenantsList] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Create / Edit modal state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("ANALYST");
  const [formOrgId, setFormOrgId] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formMenuAccess, setFormMenuAccess] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isSuper = user?.role === "SUPERADMIN";

  const loadUsersAndTenants = useCallback(async () => {
    if (!isSuper) return;
    setLoading(true);
    try {
      const [uRes, tRes] = await Promise.all([
        apiGet<{ users: ManagedUser[] }>("/api/admin/users"),
        apiGet<{ tenants: TenantOption[] }>("/api/admin/tenants"),
      ]);
      setUsersList(uRes.users || []);
      setTenantsList(tRes.tenants || []);
    } catch (err) {
      toast({
        title: "Gagal memuat data pengguna",
        description: err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [isSuper, toast]);

  useEffect(() => {
    void loadUsersAndTenants();
  }, [loadUsersAndTenants]);

  const openCreateDialog = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("ANALYST");
    setFormOrgId(tenantsList[0]?.id || user?.organization.id || "");
    setFormIsActive(true);
    setFormMenuAccess(DEFAULT_MENUS_BY_ROLE["ANALYST"] || []);
    setDialogOpen(true);
  };

  const openEditDialog = (u: ManagedUser) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword(""); // leave blank unless changing
    setFormRole(u.role);
    setFormOrgId(u.organizationId);
    setFormIsActive(u.isActive);
    setFormMenuAccess(u.menuAccess?.length ? u.menuAccess : DEFAULT_MENUS_BY_ROLE[u.role] || []);
    setDialogOpen(true);
  };

  const handleRoleChange = (newRole: string) => {
    setFormRole(newRole);
    // Suggest default menu access for this role if creating or user wants standard
    setFormMenuAccess(DEFAULT_MENUS_BY_ROLE[newRole] || []);
  };

  const toggleMenu = (key: string) => {
    setFormMenuAccess((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    if (!formName.trim() || !formEmail.trim() || !formOrgId) {
      toast({ title: "Form Belum Lengkap", description: "Nama, email, dan organisasi wajib diisi.", variant: "destructive" });
      return;
    }
    if (!editingUser && (!formPassword || formPassword.length < 6)) {
      toast({ title: "Password Kurang", description: "Password minimal 6 karakter.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        // Update user
        const body: Record<string, unknown> = {
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          organizationId: formOrgId,
          isActive: formIsActive,
          menuAccess: formMenuAccess,
        };
        if (formPassword.trim()) {
          body.password = formPassword.trim();
        }

        await apiSend(`/api/admin/users/${editingUser.id}`, "PATCH", body);
        toast({ title: "Berhasil", description: `Pengguna ${formName} berhasil diperbarui.` });
      } else {
        // Create user
        await apiSend("/api/admin/users", "POST", {
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          password: formPassword.trim(),
          role: formRole,
          organizationId: formOrgId,
          isActive: formIsActive,
          menuAccess: formMenuAccess,
        });
        toast({ title: "Berhasil", description: `Pengguna ${formName} berhasil ditambahkan.` });
      }

      setDialogOpen(false);
      void loadUsersAndTenants();
    } catch (err) {
      toast({
        title: "Gagal Menyimpan Pengguna",
        description: err instanceof Error ? err.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiSend(`/api/admin/users/${deleteTarget.id}`, "DELETE");
      toast({ title: "Pengguna Dihapus", description: `Akun ${deleteTarget.email} berhasil dihapus.` });
      setDeleteTarget(null);
      void loadUsersAndTenants();
    } catch (err) {
      toast({
        title: "Gagal Menghapus",
        description: err instanceof Error ? err.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleApproveUser = async (targetUser: ManagedUser) => {
    try {
      await apiSend(`/api/admin/users/${targetUser.id}`, "PATCH", { isActive: true });
      toast({
        title: "Akun Berhasil Disetujui",
        description: `Akun ${targetUser.name} (${targetUser.email}) telah disetujui dan kini dapat login ke aplikasi.`,
      });
      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, isActive: true } : u))
      );
    } catch (err) {
      toast({
        title: "Gagal menyetujui akun",
        description: err instanceof Error ? err.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    }
  };

  if (!isSuper) {
    return (
      <Card className="border-red-500/20 bg-red-500/5 p-6 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-red-600 mb-3" />
        <h3 className="text-lg font-bold text-red-800 dark:text-red-300">Akses Terbatas</h3>
        <p className="mt-1 text-sm text-red-600/90">
          Menu Pengaturan User hanya dapat diakses oleh akun dengan peran <strong>SUPERADMIN</strong>.
        </p>
      </Card>
    );
  }

  const filteredUsers = usersList.filter((u) => {
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.organization?.name.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Manajemen Pengguna & Hak Akses Menu</h2>
          <p className="text-sm text-muted-foreground">
            Kelola seluruh akun laboratorium, tambah pengguna baru, atur organisasi/tenant, dan tentukan checklist hak akses menu aplikasi.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="bg-teal-700 hover:bg-teal-800 text-white">
          <UserPlus className="mr-2 h-4 w-4" /> Tambah Pengguna Baru
        </Button>
      </div>

      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, email, atau organisasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Filter Peran:</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              <option value="">Semua Peran</option>
              <option value="SUPERADMIN">SUPERADMIN</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPERVISOR">SUPERVISOR</option>
              <option value="ANALYST">ANALYST</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Daftar Akun Pengguna ({filteredUsers.length})</CardTitle>
          <CardDescription>
            Menampilkan pengguna dari seluruh tenant terdaftar. Hak akses menu ditampilkan sebagai lencana.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Tidak ada akun pengguna yang sesuai dengan filter.
            </div>
          ) : (
            <div className="max-h-[38rem] overflow-x-auto overflow-y-auto rounded-lg border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 border-b bg-muted/70 backdrop-blur">
                  <tr>
                    <th className="p-3 font-semibold text-muted-foreground">Nama Pengguna</th>
                    <th className="p-3 font-semibold text-muted-foreground">Peran</th>
                    <th className="p-3 font-semibold text-muted-foreground">Organisasi / Tenant</th>
                    <th className="p-3 font-semibold text-muted-foreground min-w-[220px]">Checklist Akses Menu</th>
                    <th className="p-3 font-semibold text-muted-foreground w-24 text-center">Status</th>
                    <th className="p-3 font-semibold text-muted-foreground w-28 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map((u) => {
                    const isOwnAccount = u.id === user?.id;
                    return (
                      <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3">
                          <p className="font-semibold text-foreground">{u.name}</p>
                          <p className="text-[11px] text-muted-foreground">{u.email}</p>
                        </td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-semibold",
                              u.role === "SUPERADMIN"
                                ? "bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30"
                                : u.role === "ADMIN"
                                ? "bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30"
                                : u.role === "SUPERVISOR"
                                ? "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30"
                                : "bg-slate-500/15 text-slate-800 dark:text-slate-300 border-slate-500/30"
                            )}
                          >
                            {u.role}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-foreground">{u.organization?.name || "Organisasi Demo"}</p>
                          <p className="text-[10px] text-muted-foreground">Plan: {u.organization?.plan || "PRO"}</p>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {u.role === "SUPERADMIN" ? (
                              <Badge variant="outline" className="bg-purple-500/10 text-purple-700 text-[10px]">
                                Akses Penuh (Superadmin)
                              </Badge>
                            ) : u.menuAccess && u.menuAccess.length > 0 ? (
                              u.menuAccess.map((m) => (
                                <span
                                  key={m}
                                  className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                                >
                                  {m}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">Default Sesuai Peran</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              u.isActive
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            )}
                          >
                            {u.isActive ? "Aktif" : "Menunggu Persetujuan"}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!u.isActive && !isOwnAccount && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApproveUser(u)}
                                className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-sm gap-1"
                                title="Setujui dan Aktifkan Akun"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Setujui
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(u)}
                              className="h-7 w-7 text-teal-700 hover:bg-teal-50"
                              title="Edit Pengguna"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            {!isOwnAccount && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(u)}
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                title="Hapus Pengguna"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit Akun Pengguna" : "Tambah Pengguna Baru"}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? `Perbarui profil, kata sandi, dan hak akses menu untuk ${editingUser.name}.`
                : "Daftarkan akun pengguna baru dan tentukan hak akses menu yang diizinkan."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nama & Email */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Nama Lengkap</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Misal: Budi Pratama, S.Tr.Kes"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Alamat Email</label>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="analis@laboratorium.id"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Password & Peran */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {editingUser ? "Ganti Password (Kosongkan jika tidak diubah)" : "Password Awal"}
                </label>
                <Input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? "••••••••" : "Minimal 6 karakter"}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Peran Pengguna</label>
                <select
                  value={formRole}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
                >
                  <option value="ANALYST">ANALYST (Analis QA)</option>
                  <option value="SUPERVISOR">SUPERVISOR (Penyelia)</option>
                  <option value="ADMIN">ADMIN (Admin Laboratorium)</option>
                  <option value="SUPERADMIN">SUPERADMIN (Super Admin Sistem)</option>
                </select>
              </div>
            </div>

            {/* Organisasi / Tenant & Status */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Organisasi / Tenant</label>
                <select
                  value={formOrgId}
                  onChange={(e) => setFormOrgId(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
                >
                  {tenantsList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.plan})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <label htmlFor="isActiveCheck" className="text-xs font-medium cursor-pointer">
                  Akun Aktif (Dapat Login)
                </label>
              </div>
            </div>

            {/* Checklist Hak Akses Menu */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Checklist Hak Akses Menu Aplikasi</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Centang menu apa saja yang dapat dilihat dan diakses oleh pengguna ini.
                  </p>
                </div>
                <div className="flex gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setFormMenuAccess(ALL_MENUS.map((m) => m.key))}
                    className="text-teal-700 hover:underline"
                  >
                    Pilih Semua
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setFormMenuAccess(DEFAULT_MENUS_BY_ROLE[formRole] || [])}
                    className="text-teal-700 hover:underline"
                  >
                    Default Peran
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-lg border bg-muted/25 p-3">
                {ALL_MENUS.map((item) => {
                  const checked = formMenuAccess.includes(item.key);
                  // Hide superAdminOnly menu from checklist if role is not SUPERADMIN
                  if (item.superAdminOnly && formRole !== "SUPERADMIN") return null;

                  return (
                    <label
                      key={item.key}
                      className={cn(
                        "flex items-start gap-2.5 rounded-md p-2 border transition-colors cursor-pointer text-left",
                        checked ? "bg-teal-50/70 border-teal-600/30 dark:bg-teal-950/30" : "bg-card border-border hover:bg-muted/50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMenu(item.key)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <div className="leading-tight">
                        <p className="text-xs font-semibold text-foreground">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-700 hover:bg-teal-800 text-white"
            >
              {saving ? "Menyimpan..." : editingUser ? "Simpan Perubahan" : "Tambah Pengguna"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Akun Pengguna?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus akun <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email})?
              Tindakan ini permanen dan akan dicatat dalam Log Audit sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleting ? "Menghapus..." : "Hapus Akun"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
