import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Loader2,
  Megaphone,
  Tag,
  Users,
  UserPlus,
  Eye,
  Ban,
  CheckCircle,
  X,
  Copy,
  Check,
  TrendingUp,
} from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/apiFetch";

interface Marketer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  coupons_issued: number;
  total_conversions: number;
  total_registrations: number;
}

interface Coupon {
  id: string;
  code: string;
  marketer_id: string;
  marketer_name: string;
  bonus_tokens: number;
  expires_at: string;
  max_redemptions: number | null;
  is_revoked: boolean;
  created_at: string;
  conversions: number;
  registrations: number;
  status: "active" | "expired" | "revoked";
}

interface MarketerReport {
  marketer: Marketer;
  coupons: Array<
    Coupon & {
      converted_users: Array<{
        user_id: string;
        full_name: string | null;
        email: string | null;
        tokens_awarded: number;
        redeemed_at: string;
      }>;
    }
  >;
}

type ActiveTab = "marketers" | "coupons";

async function readApiJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(text.slice(0, 160));
  }
}

export function AdminMarketingPage({
  showToast,
}: {
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [tab, setTab] = useState<ActiveTab>("marketers");
  const [marketers, setMarketers] = useState<Marketer[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: "", phone: "", email: "", notes: "" });
  const [addBusy, setAddBusy] = useState(false);

  const [genOpen, setGenOpen] = useState(false);
  const [genMarketerId, setGenMarketerId] = useState("");
  const [genBonusTokens, setGenBonusTokens] = useState("");
  const [genMaxRedemptions, setGenMaxRedemptions] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<MarketerReport | null>(null);

  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const fetchMarketers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/marketers");
      const j = await readApiJson(res);
      setMarketers((j.marketers as Marketer[]) || []);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/coupons");
      const j = await readApiJson(res);
      setCoupons((j.coupons as Coupon[]) || []);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "marketers") fetchMarketers();
    else fetchCoupons();
  }, [tab]);

  const handleAddMarketer = async () => {
    if (!addForm.fullName.trim()) {
      showToast("Full name is required", "error");
      return;
    }
    setAddBusy(true);
    try {
      const res = await apiFetch("/api/admin/marketers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: addForm.fullName.trim(),
          phone: addForm.phone.trim() || undefined,
          email: addForm.email.trim() || undefined,
          notes: addForm.notes.trim() || undefined,
        }),
      });
      const j = await readApiJson(res);
      if (!res.ok) throw new Error(String(j.error || "Failed"));
      showToast("Marketer created", "success");
      setAddOpen(false);
      setAddForm({ fullName: "", phone: "", email: "", notes: "" });
      await fetchMarketers();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setAddBusy(false);
    }
  };

  const toggleMarketerActive = async (id: string, isActive: boolean) => {
    setActionBusy(id);
    try {
      const res = await apiFetch(`/api/admin/marketers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const j = await readApiJson(res);
        throw new Error(String(j.error || "Failed"));
      }
      showToast(isActive ? "Marketer reactivated" : "Marketer deactivated", "success");
      await fetchMarketers();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setActionBusy(null);
    }
  };

  const openReport = async (id: string) => {
    setReportOpen(true);
    setReportLoading(true);
    setReportData(null);
    try {
      const res = await apiFetch(`/api/admin/marketers/${id}/report`);
      const j = await readApiJson(res);
      if (!res.ok) throw new Error(String(j.error || "Failed"));
      setReportData(j as unknown as MarketerReport);
    } catch (e: any) {
      showToast(e.message, "error");
      setReportOpen(false);
    } finally {
      setReportLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!genMarketerId) {
      showToast("Select a marketer", "error");
      return;
    }
    setGenBusy(true);
    setGenResult(null);
    try {
      const body: Record<string, unknown> = { marketerId: genMarketerId };
      const bt = parseInt(genBonusTokens, 10);
      if (Number.isFinite(bt) && bt > 0) body.bonusTokens = bt;
      const mr = parseInt(genMaxRedemptions, 10);
      if (Number.isFinite(mr) && mr > 0) body.maxRedemptions = mr;

      const res = await apiFetch("/api/admin/coupons/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await readApiJson(res);
      if (!res.ok) throw new Error(String(j.error || "Failed"));
      const coupon = j.coupon as { code: string };
      setGenResult(coupon.code);
      showToast(`Coupon ${coupon.code} generated`, "success");
      if (tab === "coupons") fetchCoupons();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setGenBusy(false);
    }
  };

  const revokeCoupon = async (id: string) => {
    if (!confirm("Revoke this coupon? It will no longer be usable.")) return;
    setActionBusy(id);
    try {
      const res = await apiFetch(`/api/admin/coupons/${id}/revoke`, { method: "POST" });
      if (!res.ok) {
        const j = await readApiJson(res);
        throw new Error(String(j.error || "Failed"));
      }
      showToast("Coupon revoked", "success");
      await fetchCoupons();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setActionBusy(null);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const statusBadge = (status: string) => {
    if (status === "active")
      return (
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
          Active
        </span>
      );
    if (status === "expired")
      return (
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-500/10 px-2 py-0.5 rounded-md border border-zinc-500/20">
          Expired
        </span>
      );
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20">
        Revoked
      </span>
    );
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="p-2 rounded-full hover:bg-white/5 text-zinc-400 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Marketing & Coupons</h1>
            <p className="text-zinc-500 mt-1">
              Create marketers, generate coupon codes, and track conversions.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {tab === "marketers" && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add marketer
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setGenOpen(true);
              setGenResult(null);
              setGenMarketerId(marketers.length ? marketers[0].id : "");
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-amber-500/40 text-amber-400 font-bold hover:bg-amber-500/10 transition-colors"
          >
            <Tag className="w-4 h-4" />
            Generate coupon
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-8 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setTab("marketers")}
          className={cn(
            "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
            tab === "marketers" ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
          )}
        >
          <Users className="w-4 h-4" />
          Marketers
        </button>
        <button
          type="button"
          onClick={() => setTab("coupons")}
          className={cn(
            "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
            tab === "coupons" ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
          )}
        >
          <Tag className="w-4 h-4" />
          Coupons
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      ) : tab === "marketers" ? (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Name</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Contact</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-center">Coupons</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-center">Signups</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-center">Conversions</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {marketers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-zinc-500">
                      No marketers yet. Add your first one above.
                    </td>
                  </tr>
                ) : (
                  marketers.map((m) => (
                    <tr key={m.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-6 py-4">
                        <p className="font-bold text-white">{m.full_name}</p>
                        {m.notes && <p className="text-[10px] text-zinc-600 mt-0.5">{m.notes}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-zinc-300">{m.email || "—"}</p>
                        <p className="text-xs text-zinc-500">{m.phone || ""}</p>
                      </td>
                      <td className="px-6 py-4">
                        {m.is_active ? (
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-white">
                        {m.coupons_issued}
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-zinc-300">
                        {m.total_registrations}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-bold text-emerald-400">{m.total_conversions}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openReport(m.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Report
                          </button>
                          <button
                            type="button"
                            disabled={!!actionBusy}
                            onClick={() => toggleMarketerActive(m.id, !m.is_active)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors disabled:opacity-50",
                              m.is_active
                                ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            )}
                          >
                            {actionBusy === m.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : m.is_active ? (
                              <Ban className="w-3.5 h-3.5" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            {m.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Code</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Marketer</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Created</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Expires</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-center">Signups</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-center">Conversions</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-center">Bonus</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center text-zinc-500">
                      No coupons generated yet.
                    </td>
                  </tr>
                ) : (
                  coupons.map((c) => (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-white tracking-wider">{c.code}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-300">{c.marketer_name}</td>
                      <td className="px-6 py-4 text-xs text-zinc-500">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-500">
                        {new Date(c.expires_at).toLocaleString("en-KE", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4">{statusBadge(c.status)}</td>
                      <td className="px-6 py-4 text-center text-sm text-zinc-300">{c.registrations}</td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-emerald-400">
                        {c.conversions}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-amber-400">{c.bonus_tokens}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => copyCode(c.code)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 text-xs text-zinc-400 hover:text-white hover:bg-white/5"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          {c.status === "active" && (
                            <button
                              type="button"
                              disabled={!!actionBusy}
                              onClick={() => revokeCoupon(c.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-xs font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                            >
                              {actionBusy === c.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Ban className="w-3.5 h-3.5" />
                              )}
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Marketer Modal */}
      <AnimatePresence>
        {addOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setAddOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Add marketer</h2>
                <button type="button" onClick={() => setAddOpen(false)} className="p-2 rounded-full hover:bg-white/10 text-zinc-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500">Full name *</span>
                <input
                  value={addForm.fullName}
                  onChange={(e) => setAddForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500">Phone</span>
                <input
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500">Email</span>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500">Notes</span>
                <textarea
                  value={addForm.notes}
                  onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm resize-none"
                />
              </label>
              <button
                type="button"
                disabled={addBusy}
                onClick={handleAddMarketer}
                className="w-full py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Create marketer
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate Coupon Modal */}
      <AnimatePresence>
        {genOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => { setGenOpen(false); setGenResult(null); }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Generate coupon</h2>
                <button type="button" onClick={() => { setGenOpen(false); setGenResult(null); }} className="p-2 rounded-full hover:bg-white/10 text-zinc-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {genResult ? (
                <div className="text-center py-6 space-y-4">
                  <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Coupon code</p>
                  <p className="text-3xl font-mono font-bold text-amber-400 tracking-[0.2em]">
                    {genResult}
                  </p>
                  <button
                    type="button"
                    onClick={() => copyCode(genResult)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 text-sm font-bold text-zinc-300 hover:bg-white/5"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied" : "Copy code"}
                  </button>
                  <p className="text-[11px] text-zinc-500">
                    Share this code with the marketer. It expires in 48 hours.
                  </p>
                </div>
              ) : (
                <>
                  <label className="block space-y-1">
                    <span className="text-xs text-zinc-500">Marketer *</span>
                    <select
                      value={genMarketerId}
                      onChange={(e) => setGenMarketerId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                    >
                      <option value="">Select marketer</option>
                      {marketers
                        .filter((m) => m.is_active)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-zinc-500">Bonus tokens (default 3)</span>
                    <input
                      type="number"
                      min={1}
                      value={genBonusTokens}
                      onChange={(e) => setGenBonusTokens(e.target.value)}
                      placeholder="3"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-zinc-500">Max redemptions (blank = unlimited)</span>
                    <input
                      type="number"
                      min={1}
                      value={genMaxRedemptions}
                      onChange={(e) => setGenMaxRedemptions(e.target.value)}
                      placeholder="Unlimited"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={genBusy || !genMarketerId}
                    onClick={handleGenerate}
                    className="w-full py-3 rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {genBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                    Generate
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Marketer Report Modal */}
      <AnimatePresence>
        {reportOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setReportOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 bg-zinc-950/95 backdrop-blur z-10">
                <h2 className="text-lg font-bold text-white">
                  {reportData?.marketer?.full_name || "Marketer"} — Report
                </h2>
                <button type="button" onClick={() => setReportOpen(false)} className="p-2 rounded-full hover:bg-white/10 text-zinc-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {reportLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                  </div>
                ) : reportData ? (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] text-center">
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-1">Coupons</p>
                        <p className="text-2xl font-bold text-white">{reportData.coupons.length}</p>
                      </div>
                      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] text-center">
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-1">Signups</p>
                        <p className="text-2xl font-bold text-zinc-300">
                          {reportData.coupons.reduce((a, c) => a + (c.registrations || 0), 0)}
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] text-center">
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-1">Conversions</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {reportData.coupons.reduce((a, c) => a + (c.conversions || 0), 0)}
                        </p>
                      </div>
                    </div>

                    {reportData.coupons.length === 0 ? (
                      <p className="text-sm text-zinc-500 text-center py-8">No coupons issued yet.</p>
                    ) : (
                      reportData.coupons.map((c) => (
                        <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-amber-400 tracking-wider">{c.code}</span>
                              {statusBadge(c.status)}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-zinc-500">
                              <span>{c.registrations} signups</span>
                              <span className="text-emerald-400 font-bold">{c.conversions} conversions</span>
                            </div>
                          </div>
                          {c.converted_users.length > 0 ? (
                            <div className="divide-y divide-white/5">
                              {c.converted_users.map((u) => (
                                <div key={u.user_id} className="px-5 py-2.5 flex items-center justify-between text-xs">
                                  <div>
                                    <span className="text-zinc-200 font-medium">{u.full_name || "—"}</span>
                                    <span className="text-zinc-500 ml-2">{u.email}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-emerald-400 font-bold">+{u.tokens_awarded} tokens</span>
                                    <span className="text-zinc-600 ml-2">
                                      {new Date(u.redeemed_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="px-5 py-4 text-xs text-zinc-600">No conversions for this coupon.</p>
                          )}
                        </div>
                      ))
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
    </main>
  );
}
