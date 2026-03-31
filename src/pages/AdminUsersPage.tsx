import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
} from "lucide-react";
import { cn } from "../lib/utils";

interface ListedUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean | null;
  created_at: string | null;
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

export function AdminUsersPage({ showToast }: { showToast: (m: string, t?: "success" | "error") => void }) {
  const [roleTab, setRoleTab] = useState<"seeker" | "employer">("seeker");
  const [users, setUsers] = useState<ListedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPayload, setDetailPayload] = useState<Record<string, unknown> | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?role=${roleTab}`);
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
      const res = await fetch(`/api/admin/user/${id}`);
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
  };

  const setActive = async (userId: string, isActive: boolean) => {
    if (!confirm(isActive ? "Reactivate this account?" : "Deactivate this account? They will be signed out and blocked from signing in.")) return;
    setActionBusy(userId + "-act");
    try {
      const res = await fetch("/api/admin/users/set-active", {
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

  const deleteUser = async (userId: string) => {
    if (
      !confirm(
        "Permanently delete this user and their auth account? Jobs or applications may be removed depending on database rules. This cannot be undone."
      )
    )
      return;
    setActionBusy(userId + "-del");
    try {
      const res = await fetch("/api/admin/users/delete", {
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
            <p className="text-zinc-500 mt-1">Job seekers and employers — details, wallet summary, and access control.</p>
          </div>
        </div>
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
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Profile</p>
                      <p className="text-xl font-bold text-white">{String(profile.full_name || "—")}</p>
                      <p className="text-sm text-zinc-400">{String(profile.email || "")}</p>
                      <p className="text-xs text-zinc-500 capitalize">Role: {String(profile.role)}</p>
                      <p className="text-xs text-zinc-500">
                        Joined:{" "}
                        {profile.created_at
                          ? new Date(String(profile.created_at)).toLocaleString()
                          : "—"}
                      </p>
                    </div>

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

                    <div className="flex flex-wrap gap-3 pt-2">
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
                        disabled={!!actionBusy}
                        onClick={() => deleteUser(detailId)}
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold hover:bg-red-500/25 disabled:opacity-50"
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
                ) : (
                  <p className="text-zinc-500 text-center py-8">No data</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
