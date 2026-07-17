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
  ShieldBan,
  Search,
  RotateCcw,
  TrendingUp,
  KeyRound,
  ClipboardList,
} from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/apiFetch";
import { AdminPagination } from "../components/AdminPagination";

interface ListedUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean | null;
  created_at: string | null;
  employer_approval_status?: string | null;
  employer_approved_at?: string | null;
  token_balance?: number;
  earnings_balance_kes?: number;
  days_since_registration?: number;
  has_ever_topped_up?: boolean;
  needs_topup_attention?: boolean;
  is_blacklisted?: boolean;
  blacklist_reason?: string | null;
  blacklisted_at?: string | null;
  deactivation_reason?: string | null;
}

async function tryParseAdminApiJson<T>(res: Response): Promise<{
  data: T | null;
  htmlFallback: boolean;
  errorMessage?: string;
}> {
  const text = await res.text();
  const t = text.trim();
  if (!t) {
    return {
      data: null,
      htmlFallback: false,
      errorMessage: res.ok ? undefined : "Empty response",
    };
  }
  const lower = t.slice(0, 32).toLowerCase();
  if (t.startsWith("<") || lower.startsWith("<!doctype") || lower.startsWith("<html")) {
    return { data: null, htmlFallback: true };
  }
  try {
    const json = JSON.parse(t) as T & { error?: string };
    if (!res.ok) {
      return {
        data: null,
        htmlFallback: false,
        errorMessage: json.error || "Request failed",
      };
    }
    return { data: json as T, htmlFallback: false };
  } catch {
    return {
      data: null,
      htmlFallback: false,
      errorMessage: res.ok ? undefined : t.slice(0, 160),
    };
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
  const [reasonModal, setReasonModal] = useState<{
    type: "deactivate" | "blacklist";
    userId: string;
  } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [resetModal, setResetModal] = useState(false);
  const [resetStep, setResetStep] = useState<"reason" | "otp">("reason");
  const [resetReason, setResetReason] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetOtpSending, setResetOtpSending] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetMaskedEmail, setResetMaskedEmail] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim().length >= 2 ? searchInput.trim() : "";
      setSearchQuery((prev) => {
        if (prev !== next) setPage(1);
        return next;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchUsers = async (roleOverride?: RoleTab, pageOverride?: number) => {
    const role = roleOverride ?? roleTab;
    const activePage = pageOverride ?? page;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        role,
        page: String(activePage),
        pageSize: String(pageSize),
      });
      if (searchQuery) params.set("q", searchQuery);
      const res = await apiFetch(`/api/admin/users?${params.toString()}`);
      const parsed = await tryParseAdminApiJson<{
        users: ListedUser[];
        total?: number;
        totalPages?: number;
        page?: number;
        error?: string;
      }>(res);
      if (parsed.htmlFallback) {
        showToast("Admin API unreachable. Use npm run dev on port 3000.", "error");
        setUsers([]);
        return;
      }
      if (!res.ok) {
        throw new Error(parsed.errorMessage || "Failed to load users");
      }
      if (parsed.data?.users) {
        setUsers(parsed.data.users);
        setTotalUsers(Number(parsed.data.total) ?? parsed.data.users.length);
        setTotalPages(Math.max(1, Number(parsed.data.totalPages) || 1));
        if (parsed.data.page) setPage(parsed.data.page);
      } else {
        setUsers([]);
        setTotalUsers(0);
        setTotalPages(1);
      }
    } catch (e: any) {
      showToast(e.message || "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleTab, page, pageSize, searchQuery]);

  const fmtKes = (n: number) =>
    n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderUserCells = (u: ListedUser) => (
    <>
      <td className="px-6 py-4">
        <p className="font-bold text-white">{u.full_name || "—"}</p>
        <p className="text-[10px] text-zinc-600 font-mono">{u.id.slice(0, 8)}…</p>
        {u.needs_topup_attention ? (
          <p className="text-[10px] mt-1 font-bold uppercase tracking-wide text-amber-400">
            No top-up yet ({u.days_since_registration ?? 0}d)
          </p>
        ) : null}
      </td>
      <td className="px-6 py-4 text-sm text-zinc-300">{u.email}</td>
      <td className="px-6 py-4 tabular-nums text-sm text-white font-semibold">
        {u.token_balance ?? 0}
      </td>
      <td className="px-6 py-4 tabular-nums text-sm font-semibold">
        {(u.earnings_balance_kes ?? 0) > 0 ? (
          <span className="text-emerald-400">{fmtKes(u.earnings_balance_kes!)}</span>
        ) : (
          <span className="text-zinc-600">0.00</span>
        )}
      </td>
      <td className="px-6 py-4 text-sm text-zinc-400 tabular-nums">
        {u.days_since_registration ?? 0}
      </td>
      <td className="px-6 py-4">
        {u.is_blacklisted ? (
          <span className="text-xs font-bold uppercase tracking-wider text-red-300 bg-red-500/15 px-2 py-1 rounded-md border border-red-500/30">
            Blacklisted
          </span>
        ) : u.is_active === false ? (
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
      <td className="px-3 sm:px-4 py-4 text-right sticky right-0 z-[1] bg-zinc-950/95 backdrop-blur border-l border-white/5">
        <div className="inline-flex flex-nowrap items-center justify-end gap-2">
          {(roleTab === "seeker" || u.role === "seeker") && (
            <Link
              to={`/admin/users/${u.id}/works`}
              title="Prompts, admin reviews, and job applications"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-black text-xs sm:text-sm font-bold hover:bg-emerald-400 transition-colors shrink-0"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Activity</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => openDetail(u.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 text-xs sm:text-sm font-bold text-emerald-400 hover:bg-emerald-500/10 transition-colors shrink-0"
          >
            <Eye className="w-4 h-4" />
            <span>Details</span>
          </button>
        </div>
      </td>
    </>
  );

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

  const setActive = async (userId: string, isActive: boolean, reason?: string) => {
    if (isActive) {
      if (!confirm("Reactivate this account? The user will regain full access (unless email is blacklisted).")) {
        return;
      }
    }
    setActionBusy(userId + "-act");
    try {
      const res = await apiFetch("/api/admin/users/set-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          isActive,
          ...(reason ? { reason } : {}),
        }),
      });
      const j = await readApiJson(res);
      if (!res.ok) throw new Error(String(j.error || "Failed"));
      showToast(
        isActive
          ? "Account reactivated"
          : "Account deactivated — regret email sent with reactivation instructions"
      );
      await fetchUsers();
      if (detailId === userId) {
        await openDetail(userId);
      }
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setActionBusy(null);
    }
  };

  const openDeactivateModal = (userId: string) => {
    setReasonText("");
    setReasonModal({ type: "deactivate", userId });
  };

  const openBlacklistModal = (userId: string) => {
    setReasonText("");
    setReasonModal({ type: "blacklist", userId });
  };

  const submitReasonAction = async () => {
    if (!reasonModal) return;
    const reason = reasonText.trim();
    if (!reason) {
      showToast("A reason is required", "error");
      return;
    }

    if (reasonModal.type === "deactivate") {
      setReasonModal(null);
      await setActive(reasonModal.userId, false, reason);
      return;
    }

    setActionBusy(reasonModal.userId + "-bl");
    try {
      const res = await apiFetch("/api/admin/users/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: reasonModal.userId, reason }),
      });
      const j = await readApiJson(res);
      if (!res.ok) throw new Error(String(j.error || "Blacklist failed"));
      showToast("User blacklisted — email permanently blocked", "success");
      setReasonModal(null);
      await fetchUsers();
      if (detailId === reasonModal.userId) {
        await openDetail(reasonModal.userId);
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
        "Reject this employer registration? Their account will be deactivated, a regret email will be sent, and they can reactivate by purchasing tokens."
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
        "Permanently delete this user? Their auth account, profile, jobs, applications, wallet data, and related records will be removed. This cannot be undone. (If the email was blacklisted, it will remain blocked.)"
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
  const blacklist = detailPayload?.blacklist as Record<string, unknown> | null | undefined;
  const transactions = (detailPayload?.transactions as unknown[]) ?? [];
  const isBlacklisted = Boolean(blacklist?.email);

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
          onClick={() => {
            setRoleTab("seeker");
            setPage(1);
          }}
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
          onClick={() => {
            setRoleTab("employer");
            setPage(1);
          }}
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
          onClick={() => {
            setRoleTab("admin");
            setPage(1);
          }}
          className={cn(
            "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
            roleTab === "admin" ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
          )}
        >
          <Shield className="w-4 h-4" />
          Administrators
        </button>
      </div>

      {roleTab !== "admin" ? (
        <p className="mb-4 text-xs text-zinc-500 flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-500/20 ring-1 ring-amber-500/40" />
          Highlighted rows: registered more than 2 days ago with no token top-up yet.
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or email (min 2 chars)"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-600"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-500">
          <span>Per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-white text-sm"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
          <div className="overflow-auto max-h-[640px]">
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Name</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Email</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Tokens</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Earnings (KES)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Member days</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Status</th>
                  <th className="px-3 sm:px-4 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right sticky right-0 z-[2] bg-zinc-950/95 backdrop-blur border-l border-white/5 min-w-[11rem]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-zinc-500">
                      {searchQuery ? "No users match your search." : "No users in this list."}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className={cn(
                        "border-b border-white/5 hover:bg-white/[0.02]",
                        u.needs_topup_attention &&
                          "bg-amber-500/[0.07] hover:bg-amber-500/[0.1] ring-1 ring-inset ring-amber-500/20"
                      )}
                    >
                      {renderUserCells(u)}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <AdminPagination
            page={page}
            totalPages={totalPages}
            total={totalUsers}
            loading={loading}
            onPageChange={setPage}
          />
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
                        {users.find((u) => u.id === detailId)?.days_since_registration != null ? (
                          <span className="text-zinc-600">
                            {" "}
                            · {users.find((u) => u.id === detailId)?.days_since_registration} days
                            as member
                          </span>
                        ) : null}
                      </p>
                      {isBlacklisted ? (
                        <div className="rounded-xl bg-red-950/40 border border-red-500/30 px-4 py-3 text-sm text-red-100 space-y-1">
                          <p className="font-semibold text-red-200">Email blacklisted — permanent ban</p>
                          <p className="text-xs text-red-200/90">
                            Reason: {String(blacklist?.reason || "—")}
                          </p>
                          <p className="text-xs text-red-300/80">
                            This email cannot sign in, register, receive gifts, or reactivate via tokens.
                          </p>
                        </div>
                      ) : profile.is_active === false ? (
                        <div className="space-y-1">
                          <p className="text-xs text-amber-400 font-medium">
                            Account paused — user can sign in and reactivate by purchasing or receiving
                            tokens.
                          </p>
                          {profile.deactivation_reason ? (
                            <p className="text-xs text-zinc-500">
                              Deactivation reason:{" "}
                              <span className="text-zinc-300">{String(profile.deactivation_reason)}</span>
                            </p>
                          ) : null}
                        </div>
                      ) : null}
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

                    {profile.role === "seeker" ? (
                    <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-widest">
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                          Earnings Balance
                        </div>
                        {Number(detailPayload?.earnings_balance_kes ?? 0) > 0 ? (
                          <button
                            type="button"
                            disabled={!!actionBusy}
                            onClick={() => {
                              setResetModal(true);
                              setResetStep("reason");
                              setResetReason("");
                              setResetOtp("");
                              setResetMaskedEmail("");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reset Earnings
                          </button>
                        ) : null}
                      </div>
                      <p className="text-2xl font-bold tabular-nums">
                        {Number(detailPayload?.earnings_balance_kes ?? 0) > 0 ? (
                          <span className="text-emerald-400">
                            KES {fmtKes(Number(detailPayload?.earnings_balance_kes ?? 0))}
                          </span>
                        ) : (
                          <span className="text-zinc-600">KES 0.00</span>
                        )}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Net balance from prompt rewards, adjustments, and withdrawals
                      </p>
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

                    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-zinc-500 space-y-1">
                      <p>
                        <strong className="text-zinc-400">Deactivate</strong> — temporary pause; user may return via token top-up.
                      </p>
                      <p>
                        <strong className="text-zinc-400">Blacklist</strong> — permanent email ban; no sign-in, signup, or gifts.
                      </p>
                      <p>
                        <strong className="text-zinc-400">Delete</strong> — removes the account and all attached data permanently.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      {profile.role === "seeker" && detailId ? (
                        <Link
                          to={`/admin/users/${detailId}/works`}
                          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-500/40 text-emerald-300 font-bold hover:bg-emerald-500/10"
                        >
                          <ClipboardList className="w-4 h-4" />
                          Activity
                        </Link>
                      ) : null}
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
                      {profile.role !== "admin" && !isBlacklisted ? (
                        profile.is_active === false ? (
                        <button
                          type="button"
                          disabled={!!actionBusy}
                          onClick={() => detailId && setActive(detailId, true)}
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
                          onClick={() => detailId && openDeactivateModal(detailId)}
                          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-500/40 text-amber-400 font-bold hover:bg-amber-500/10 disabled:opacity-50"
                        >
                          {actionBusy === detailId + "-act" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Ban className="w-4 h-4" />
                          )}
                          Deactivate
                        </button>
                      )
                      ) : null}
                      {profile.role !== "admin" && !isBlacklisted ? (
                        <button
                          type="button"
                          disabled={!!actionBusy}
                          onClick={() => detailId && openBlacklistModal(detailId)}
                          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/50 text-red-300 font-bold hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {actionBusy === detailId + "-bl" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ShieldBan className="w-4 h-4" />
                          )}
                          Blacklist
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={!!actionBusy || summary?.can_delete === false}
                        title={
                          summary?.can_delete === false
                            ? "Delete only when wallet tokens have expired or balance is zero"
                            : "Permanently delete user and all attached data"
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
        {reasonModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setReasonModal(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white">
                {reasonModal.type === "blacklist" ? "Blacklist user" : "Deactivate account"}
              </h3>
              <p className="text-sm text-zinc-500 mt-2">
                {reasonModal.type === "blacklist"
                  ? "This email will be permanently blocked from JobToken. The user will receive a notification email."
                  : "The account will be paused. The user may return by purchasing tokens. A regret email will be sent."}
              </p>
              <label className="block mt-4 space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Reason (required)
                </span>
                <textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  rows={4}
                  placeholder="Explain why this action is being taken…"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 resize-y min-h-[96px]"
                />
              </label>
              <div className="flex flex-wrap gap-3 mt-6 justify-end">
                <button
                  type="button"
                  onClick={() => setReasonModal(null)}
                  className="px-4 py-2.5 rounded-xl border border-white/15 text-sm font-bold text-zinc-400 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!!actionBusy || !reasonText.trim()}
                  onClick={submitReasonAction}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50",
                    reasonModal.type === "blacklist"
                      ? "bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30"
                      : "bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                  )}
                >
                  {reasonModal.type === "blacklist" ? "Confirm blacklist" : "Confirm deactivate"}
                </button>
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

      <AnimatePresence>
        {resetModal && detailId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setResetModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-red-400" />
                  Reset Earnings
                </h3>
                <button
                  type="button"
                  onClick={() => setResetModal(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-zinc-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
                <p className="font-semibold text-amber-300">This action is irreversible</p>
                <p className="text-xs mt-1">
                  A contra-entry of{" "}
                  <strong>KES {fmtKes(Number(detailPayload?.earnings_balance_kes ?? 0))}</strong>{" "}
                  will be posted to zero out{" "}
                  <strong>{String(profile?.full_name || profile?.email || "this user")}</strong>'s earnings.
                </p>
              </div>

              {resetStep === "reason" ? (
                <>
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                      Reason for reset (required — stored in audit trail)
                    </span>
                    <textarea
                      value={resetReason}
                      onChange={(e) => setResetReason(e.target.value)}
                      rows={3}
                      placeholder="e.g. Duplicate earnings, test account cleanup, policy violation…"
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 resize-y min-h-[80px]"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setResetModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-white/15 text-sm font-bold text-zinc-400 hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!resetReason.trim() || resetOtpSending}
                      onClick={async () => {
                        setResetOtpSending(true);
                        try {
                          const res = await apiFetch(
                            `/api/admin/users/${detailId}/earnings-reset-otp`,
                            { method: "POST" }
                          );
                          const j = await res.json().catch(() => ({}));
                          if (!res.ok) throw new Error(j.error || "Failed to send OTP");
                          setResetMaskedEmail(j.email || "");
                          setResetStep("otp");
                          showToast("Verification code sent to your email", "success");
                        } catch (e: any) {
                          showToast(e.message || "OTP request failed", "error");
                        } finally {
                          setResetOtpSending(false);
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/25 disabled:opacity-50"
                    >
                      {resetOtpSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <KeyRound className="w-4 h-4" />
                      )}
                      Send verification code
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-zinc-400">
                    A 6-digit code has been sent to <strong className="text-white">{resetMaskedEmail}</strong>.
                    Enter it below to confirm the reset.
                  </p>
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                      Verification code
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] text-white placeholder:text-zinc-700"
                    />
                  </label>
                  <p className="text-xs text-zinc-600">
                    Reason: <span className="text-zinc-400">{resetReason}</span>
                  </p>
                  <div className="flex flex-wrap gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setResetStep("reason");
                        setResetOtp("");
                      }}
                      className="px-4 py-2.5 rounded-xl border border-white/15 text-sm font-bold text-zinc-400 hover:bg-white/5"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={resetOtp.length !== 6 || resetSubmitting}
                      onClick={async () => {
                        setResetSubmitting(true);
                        try {
                          const res = await apiFetch(
                            `/api/admin/users/${detailId}/earnings-reset`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ otp: resetOtp, reason: resetReason.trim() }),
                            }
                          );
                          const j = await res.json().catch(() => ({}));
                          if (!res.ok) throw new Error(j.error || "Reset failed");
                          showToast(
                            `Earnings reset: KES ${fmtKes(j.previous_balance ?? 0)} → KES ${fmtKes(j.new_balance ?? 0)}`,
                            "success"
                          );
                          setResetModal(false);
                          await openDetail(detailId);
                          await fetchUsers();
                        } catch (e: any) {
                          showToast(e.message || "Reset failed", "error");
                        } finally {
                          setResetSubmitting(false);
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-400 disabled:opacity-50"
                    >
                      {resetSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      Confirm reset
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
