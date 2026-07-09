import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Loader2,
  Users,
  Briefcase,
  Eye,
  Ban,
  CheckCircle,
  Trash2,
  X,
  Wallet,
  Coins,
  FileText,
  Shield,
  UserPlus,
  Pencil,
} from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/apiFetch";

interface ListedUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean | null;
  created_at: string | null;
  employer_approval_status?: string | null;
  employer_approved_at?: string | null;
}

async function tryParseAdminApiJson<T>(res: Response): Promise<{
  data: T | null;
  htmlFallback: boolean;
}> {
  const text = await res.text();
  if (!res.ok) return { data: null, htmlFallback: false };
  const t = text.trim();
  if (!t) return { data: null, htmlFallback: false };
  const lower = t.slice(0, 32).toLowerCase();
  if (t.startsWith("<") || lower.startsWith("<!doctype") || lower.startsWith("<html")) {
    return { data: null, htmlFallback: true };
  }
  try {
    return { data: JSON.parse(t) as T, htmlFallback: false };
  } catch {
    return { data: null, htmlFallback: false };
  }
}

async function readApiJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(text.slice(0, 160));
  }
}

type RoleTab = "seeker" | "employer" | "admin";

interface EditUserForm {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  companyName: string;
  officeLocation: string;
  areaOfBusiness: string;
  linkedinUrl: string;
}

interface AddAdminForm {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

const emptyEditForm = (): EditUserForm => ({
  fullName: "",
  email: "",
  phone: "",
  location: "",
  companyName: "",
  officeLocation: "",
  areaOfBusiness: "",
  linkedinUrl: "",
});

export function AdminUsersPage({ showToast }: { showToast: (m: string, t?: "success" | "error") => void }) {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [roleTab, setRoleTab] = useState<RoleTab>(() =>
    tabParam === "employer" ? "employer" : tabParam === "admin" ? "admin" : "seeker"
  );
  const [users, setUsers] = useState<ListedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPayload, setDetailPayload] = useState<Record<string, unknown> | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EditUserForm>(emptyEditForm);
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [addAdminForm, setAddAdminForm] = useState<AddAdminForm>({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });

  const fetchUsers = async (roleOverride?: RoleTab) => {
    const role = roleOverride ?? roleTab;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/users?role=${role}`);
      const parsed = await tryParseAdminApiJson<{ users: ListedUser[] }>(res);
      if (parsed.htmlFallback) {
        showToast("Admin API unreachable. Use npm run dev on port 3000.", "error");
        setUsers([]);
        return;
      }
      if (parsed.data?.users) setUsers(parsed.data.users);
      else setUsers([]);
    } catch (e: any) {
      showToast(e.message || "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleTab]);

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetailPayload(null);
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/api/admin/user/${id}`);
      const parsed = await tryParseAdminApiJson<Record<string, unknown>>(res);
      if (!res.ok || !parsed.data) {
        showToast("Could not load user details", "error");
        setDetailId(null);
        return;
      }
      setDetailPayload(parsed.data);
    } catch (e: any) {
      showToast(e.message || "Failed to load details", "error");
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetailPayload(null);
    setEditMode(false);
    setEditForm(emptyEditForm());
  };

  const startEdit = () => {
    if (!profile) return;
    setEditForm({
      fullName: String(profile.full_name || ""),
      email: String(profile.email || ""),
      phone: String(profile.phone || ""),
      location: String(profile.location || ""),
      companyName: String(profile.company_name || ""),
      officeLocation: String(profile.office_location || ""),
      areaOfBusiness: String(profile.area_of_business || ""),
      linkedinUrl: String(profile.linkedin_url || ""),
    });
    setEditMode(true);
  };

  const saveEdit = async (userId: string) => {
    setActionBusy(userId + "-edit");
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editForm.fullName.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim() || null,
          location: editForm.location.trim() || null,
          companyName: editForm.companyName.trim() || null,
          officeLocation: editForm.officeLocation.trim() || null,
          areaOfBusiness: editForm.areaOfBusiness.trim() || null,
          linkedinUrl: editForm.linkedinUrl.trim() || null,
        }),
      });
      const j = await readApiJson(res);
      if (!res.ok) throw new Error(String(j.error || "Update failed"));
      showToast("User details updated", "success");
      setEditMode(false);
      if (j.profile) {
        setDetailPayload({
          ...detailPayload,
          profile: j.profile,
        });
      }
      await fetchUsers();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setActionBusy(null);
    }
  };

  const createAdmin = async () => {
    if (!addAdminForm.fullName.trim() || !addAdminForm.email.trim()) {
      showToast("Full name and email are required", "error");
      return;
    }
    setActionBusy("add-admin");
    try {
      const res = await apiFetch("/api/admin/admins/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: addAdminForm.fullName.trim(),
          email: addAdminForm.email.trim(),
          phone: addAdminForm.phone.trim() || undefined,
          password: addAdminForm.password.trim() || undefined,
        }),
      });
      const j = await readApiJson(res);
      if (!res.ok) throw new Error(String(j.error || "Could not create admin"));
      showToast(String(j.message || "Administrator created"), "success");
      setAddAdminOpen(false);
      setAddAdminForm({ fullName: "", email: "", phone: "", password: "" });
      setRoleTab("admin");
      await fetchUsers("admin");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setActionBusy(null);
    }
  };

  const setActive = async (userId: string, isActive: boolean) => {
    if (!confirm(isActive ? "Reactivate this account?" : "Deactivate this account? They will be signed out and blocked from signing in.")) return;
    setActionBusy(userId + "-act");
    try {
      const res = await apiFetch("/api/admin/users/set-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isActive }),
      });
      const j = await readApiJson(res);
      if (!res.ok) throw new Error(String(j.error || "Failed"));
      showToast(isActive ? "Account reactivated" : "Account deactivated");
      await fetchUsers();
      if (detailId === userId && detailPayload) {
        setDetailPayload({
          ...detailPayload,
          profile: { ...(detailPayload.profile as object), is_active: isActive },
        });
      }
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setActionBusy(null);
    }
  };

  const approveEmployer = async (userId: string) => {
    if (
      !confirm(
        "Approve this employer? A temporary password will be set and a welcome email will be sent with the login link and credentials."
      )
    )
      return;
    setActionBusy(userId + "-appr");
    try {
      const res = await apiFetch(`/api/admin/employers/${userId}/approve`, { method: "POST" });
      const j = await readApiJson(res);
      if (!res.ok) throw new Error(String(j.error || "Approve failed"));
      showToast("Employer approved — welcome email sent", "success");
      closeDetail();
      await fetchUsers();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setActionBusy(null);
    }
  };

  const rejectEmployer = async (userId: string) => {
    if (
      !confirm(
        "Reject this employer registration? Their account will be deactivated and they cannot post jobs."
      )
    )
      return;
    setActionBusy(userId + "-rej");
    try {
      const res = await apiFetch(`/api/admin/employers/${userId}/reject`, { method: "POST" });
      const j = await readApiJson(res);
      if (!res.ok) throw new Error(String(j.error || "Reject failed"));
      showToast("Employer registration rejected", "success");
      closeDetail();
      await fetchUsers();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setActionBusy(null);
    }
  };

  const deleteUser = async (userId: string) => {
    if (summary?.can_delete === false) {
      showToast(
        "This user still has active wallet tokens. Deactivate the account instead of deleting.",
        "error"
      );
      return;
    }
    if (
      !confirm(
        "Permanently delete this user and their auth account? Their jobs or applications will be removed. This cannot be undone."
      )
    )
      return;
    setActionBusy(userId + "-del");
    try {
      const res = await apiFetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const j = await readApiJson(res);
      if (!res.ok) throw new Error(String(j.error || "Delete failed"));
      showToast("User deleted");
      closeDetail();
      await fetchUsers();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setActionBusy(null);
    }
  };

  const profile = detailPayload?.profile as Record<string, unknown> | undefined;
  const wallet = detailPayload?.wallet as Record<string, unknown> | null | undefined;
  const summary = detailPayload?.summary as Record<string, unknown> | undefined;
  const transactions = (detailPayload?.transactions as unknown[]) ?? [];

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="p-2 rounded-full hover:bg-white/5 text-zinc-400 transition-colors"
            aria-label="Back to admin"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Users</h1>
            <p className="text-zinc-500 mt-1">
              Job seekers, employers, and administrators — access control and profile management.
            </p>
          </div>
        </div>
        {roleTab === "admin" ? (
          <button
            type="button"
            onClick={() => setAddAdminOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add administrator
          </button>
        ) : null}
      </div>

      <div className="flex gap-2 mb-8 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setRoleTab("seeker")}
          className={cn(
            "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
            roleTab === "seeker" ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
          )}
        >
          <Users className="w-4 h-4" />
          Job seekers
        </button>
        <button
          type="button"
          onClick={() => setRoleTab("employer")}
          className={cn(
            "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
            roleTab === "employer" ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
          )}
        >
          <Briefcase className="w-4 h-4" />
          Employers
        </button>
        <button
          type="button"
          onClick={() => setRoleTab("admin")}
          className={cn(
            "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
            roleTab === "admin" ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
          )}
        >
          <Shield className="w-4 h-4" />
          Administrators
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Name</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Email</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-zinc-500">
                      No users in this list.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-6 py-4">
                        <p className="font-bold text-white">{u.full_name || "—"}</p>
                        <p className="text-[10px] text-zinc-600 font-mono">{u.id.slice(0, 8)}…</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-300">{u.email}</td>
                      <td className="px-6 py-4">
                        {u.is_active === false ? (
                          <span className="text-xs font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20">
                            Deactivated
                          </span>
                        ) : (
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                            Active
                          </span>
                        )}
                        {u.role === "employer" ? (
                          <p className="text-[10px] mt-2 font-bold uppercase tracking-wide text-zinc-500">
                            Posting:{" "}
                            <span
                              className={cn(
                                u.employer_approval_status === "approved" && "text-emerald-400",
                                u.employer_approval_status === "pending" && "text-amber-400",
                                u.employer_approval_status === "rejected" && "text-red-400"
                              )}
                            >
                              {u.employer_approval_status || "—"}
                            </span>
                          </p>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openDetail(u.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 text-sm font-bold text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {detailId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={closeDetail}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 bg-zinc-950/95 backdrop-blur z-10">
                <h2 className="text-lg font-bold text-white">User summary</h2>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="p-2 rounded-full hover:bg-white/10 text-zinc-400"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {detailLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                  </div>
                ) : profile ? (
                  <>
                    {editMode && (profile.role === "employer" || profile.role === "admin") ? (
                      <div className="space-y-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                          Edit {profile.role === "admin" ? "administrator" : "employer"}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="space-y-1">
                            <span className="text-xs text-zinc-500">Full name</span>
                            <input
                              value={editForm.fullName}
                              onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs text-zinc-500">Email (username)</span>
                            <input
                              type="email"
                              value={editForm.email}
                              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs text-zinc-500">Phone</span>
                            <input
                              value={editForm.phone}
                              onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs text-zinc-500">Location</span>
                            <input
                              value={editForm.location}
                              onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                            />
                          </label>
                          {profile.role === "employer" ? (
                            <>
                              <label className="space-y-1 sm:col-span-2">
                                <span className="text-xs text-zinc-500">Company name</span>
                                <input
                                  value={editForm.companyName}
                                  onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-zinc-500">Office location</span>
                                <input
                                  value={editForm.officeLocation}
                                  onChange={(e) => setEditForm((f) => ({ ...f, officeLocation: e.target.value }))}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-zinc-500">Area of business</span>
                                <input
                                  value={editForm.areaOfBusiness}
                                  onChange={(e) => setEditForm((f) => ({ ...f, areaOfBusiness: e.target.value }))}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                                />
                              </label>
                            </>
                          ) : null}
                          <label className="space-y-1 sm:col-span-2">
                            <span className="text-xs text-zinc-500">LinkedIn URL</span>
                            <input
                              value={editForm.linkedinUrl}
                              onChange={(e) => setEditForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                            />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={!!actionBusy}
                            onClick={() => detailId && saveEdit(detailId)}
                            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 disabled:opacity-50"
                          >
                            {actionBusy === detailId + "-edit" ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Save changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditMode(false)}
                            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-white/15 text-zinc-300 font-bold hover:bg-white/5"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Profile</p>
                      <p className="text-xl font-bold text-white">{String(profile.full_name || "—")}</p>
                      <p className="text-sm text-zinc-400">{String(profile.email || "")}</p>
                      {profile.phone ? (
                        <p className="text-sm text-zinc-400">Phone: {String(profile.phone)}</p>
                      ) : null}
                      {profile.location ? (
                        <p className="text-sm text-zinc-400">Location: {String(profile.location)}</p>
                      ) : null}
                      <p className="text-xs text-zinc-500 capitalize">Role: {String(profile.role)}</p>
                      {profile.role === "employer" ? (
                        <>
                          {profile.company_name ? (
                            <p className="text-sm text-zinc-400">Company: {String(profile.company_name)}</p>
                          ) : null}
                          {profile.office_location ? (
                            <p className="text-sm text-zinc-400">
                              Office: {String(profile.office_location)}
                            </p>
                          ) : null}
                          {profile.area_of_business ? (
                            <p className="text-sm text-zinc-400">
                              Sector: {String(profile.area_of_business)}
                            </p>
                          ) : null}
                        <p className="text-xs text-zinc-400 mt-1">
                          Employer posting status:{" "}
                          <span className="text-white font-semibold capitalize">
                            {String(profile.employer_approval_status ?? "—")}
                          </span>
                          {profile.employer_approved_at ? (
                            <span className="text-zinc-500">
                              {" "}
                              · Approved{" "}
                              {new Date(String(profile.employer_approved_at)).toLocaleString()}
                            </span>
                          ) : null}
                        </p>
                        </>
                      ) : null}
                      <p className="text-xs text-zinc-500">
                        Joined:{" "}
                        {profile.created_at
                          ? new Date(String(profile.created_at)).toLocaleString()
                          : "—"}
                      </p>
                    </div>

                    {profile.role !== "admin" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
                        <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">
                          <Wallet className="w-4 h-4" />
                          Wallet
                        </div>
                        <p className="text-2xl font-bold text-white">
                          {wallet ? Number(wallet.token_balance) || 0 : 0}{" "}
                          <span className="text-sm font-medium text-zinc-500">tokens</span>
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-1">
                          Expires:{" "}
                          {wallet?.expires_at
                            ? new Date(String(wallet.expires_at)).toLocaleString()
                            : "—"}
                        </p>
                        <p className="text-[11px] text-emerald-500/90 mt-2">
                          ~Ksh {summary?.active_tokens_kes_estimate ?? 0} estimated value (
                          {summary?.kes_per_token_estimate ?? "—"} Ksh/token)
                        </p>
                        {summary?.tokens_active ? (
                          <p className="text-[11px] text-amber-400 mt-2 font-medium">
                            Active tokens — deactivate only; delete after expiry or zero balance.
                          </p>
                        ) : (
                          <p className="text-[11px] text-zinc-600 mt-2">
                            No active tokens — account may be deleted.
                          </p>
                        )}
                      </div>
                      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
                        <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">
                          <Coins className="w-4 h-4" />
                          Money (this user)
                        </div>
                        <p className="text-sm text-zinc-300">
                          Top-ups paid:{" "}
                          <span className="text-white font-bold">
                            Ksh {summary?.total_topup_kes ?? 0}
                          </span>
                        </p>
                        <p className="text-sm text-zinc-300 mt-2">
                          {profile.role === "seeker" ? (
                            <>
                              Applications:{" "}
                              <span className="text-white font-bold">
                                {summary?.applications_count ?? 0}
                              </span>
                            </>
                          ) : (
                            <>
                              Jobs posted:{" "}
                              <span className="text-white font-bold">
                                {summary?.jobs_posted_count ?? 0}
                              </span>
                            </>
                          )}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-2">
                          Tokens spent applying: {summary?.application_tokens_spent ?? 0}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Employer fees (tokens): {summary?.employer_fees_tokens ?? 0}
                        </p>
                      </div>
                    </div>
                    ) : null}

                    {profile.role !== "admin" ? (
                    <div>
                      <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">
                        <FileText className="w-4 h-4" />
                        Recent transactions
                      </div>
                      <div className="rounded-xl border border-white/10 max-h-48 overflow-y-auto divide-y divide-white/5">
                        {transactions.length === 0 ? (
                          <p className="p-4 text-sm text-zinc-500">No transactions</p>
                        ) : (
                          transactions.slice(0, 40).map((t: any) => (
                            <div key={t.id} className="px-3 py-2 flex justify-between gap-2 text-xs">
                              <span className="text-zinc-400">{t.type}</span>
                              <span
                                className={cn(
                                  "font-mono font-bold",
                                  Number(t.tokens_added) > 0 ? "text-emerald-400" : "text-red-400"
                                )}
                              >
                                {t.tokens_added > 0 ? "+" : ""}
                                {t.tokens_added}
                              </span>
                              <span className="text-zinc-600 shrink-0">
                                {t.created_at
                                  ? new Date(t.created_at).toLocaleDateString()
                                  : ""}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    ) : null}

                    <div className="flex flex-wrap gap-3 pt-2">
                      {(profile.role === "employer" || profile.role === "admin") && !editMode ? (
                        <button
                          type="button"
                          disabled={!!actionBusy}
                          onClick={startEdit}
                          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-500/40 text-emerald-400 font-bold hover:bg-emerald-500/10 disabled:opacity-50"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit details
                        </button>
                      ) : null}
                      {profile.role === "employer" &&
                      String(profile.employer_approval_status) === "pending" ? (
                        <>
                          <button
                            type="button"
                            disabled={!!actionBusy}
                            onClick={() => detailId && approveEmployer(detailId)}
                            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 disabled:opacity-50"
                          >
                            {actionBusy === detailId + "-appr" ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Approve employer
                          </button>
                          <button
                            type="button"
                            disabled={!!actionBusy}
                            onClick={() => detailId && rejectEmployer(detailId)}
                            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/40 text-red-400 font-bold hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {actionBusy === detailId + "-rej" ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Ban className="w-4 h-4" />
                            )}
                            Reject
                          </button>
                        </>
                      ) : null}
                      {profile.is_active === false ? (
                        <button
                          type="button"
                          disabled={!!actionBusy}
                          onClick={() => setActive(detailId, true)}
                          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 disabled:opacity-50"
                        >
                          {actionBusy === detailId + "-act" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Reactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!!actionBusy}
                          onClick={() => setActive(detailId, false)}
                          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-500/40 text-amber-400 font-bold hover:bg-amber-500/10 disabled:opacity-50"
                        >
                          {actionBusy === detailId + "-act" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Ban className="w-4 h-4" />
                          )}
                          Deactivate
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!!actionBusy || summary?.can_delete === false}
                        title={
                          summary?.can_delete === false
                            ? "Delete only when wallet tokens have expired or balance is zero"
                            : "Permanently delete user"
                        }
                        onClick={() => deleteUser(detailId)}
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {actionBusy === detailId + "-del" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        Delete user
                      </button>
                    </div>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-zinc-500 text-center py-8">No data</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addAdminOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setAddAdminOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Add administrator</h2>
                <button
                  type="button"
                  onClick={() => setAddAdminOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-zinc-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-zinc-500">
                Creates an admin account and emails sign-in credentials. Leave password blank to
                auto-generate a temporary one.
              </p>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500">Full name</span>
                <input
                  value={addAdminForm.fullName}
                  onChange={(e) => setAddAdminForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500">Email</span>
                <input
                  type="email"
                  value={addAdminForm.email}
                  onChange={(e) => setAddAdminForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500">Phone (optional)</span>
                <input
                  value={addAdminForm.phone}
                  onChange={(e) => setAddAdminForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500">Password (optional)</span>
                <input
                  type="password"
                  value={addAdminForm.password}
                  onChange={(e) => setAddAdminForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Auto-generated if empty"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={actionBusy === "add-admin"}
                onClick={createAdmin}
                className="w-full py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionBusy === "add-admin" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Create administrator
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
