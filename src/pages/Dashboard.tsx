import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fetchOpenJobsWithEmployer } from "../lib/fetchOpenJobs";
import { BUSINESS_AREAS, areasFocusMatch } from "../lib/businessAreas";
import { WalletDashboard } from "../components/WalletDashboard";
import { ApplicationThread } from "../components/ApplicationThread";
import { JobCard } from "../components/JobCard";
import { JobDetailModal } from "../components/JobDetailModal";
import { CompanyProfileSeekerModal } from "../components/CompanyProfileSeekerModal";
import { motion } from "motion/react";
import {
  History,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  XCircle,
  ChevronDown,
  ChevronUp,
  UserCircle,
  ClipboardList,
  MessageSquareText,
  Bell,
  Sparkles,
  Search,
  Briefcase,
} from "lucide-react";
import { cn } from "../lib/utils";
import { applicationStatusLabel, applicationStatusTone } from "../lib/applicationStatus";

interface UserApplication {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at?: string | null;
  job: {
    id?: string;
    title: string;
    job_type?: string | null;
  };
}

export function DashboardPage({ user, showToast }: { user: any, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [balance, setBalance] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [stats, setStats] = useState({ applications: 0, spent: 0 });
  const [applications, setApplications] = useState<UserApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [statusAlerts, setStatusAlerts] = useState<
    { id: string; created_at: string; payload: Record<string, unknown> }[]
  >([]);
  const [jobMatchAlerts, setJobMatchAlerts] = useState<
    { id: string; created_at: string; payload: Record<string, unknown> }[]
  >([]);

  const [boardJobs, setBoardJobs] = useState<any[]>([]);
  const [loadingBoardJobs, setLoadingBoardJobs] = useState(false);
  const [jobSearchTitle, setJobSearchTitle] = useState("");
  const [professionBoardFilter, setProfessionBoardFilter] = useState<string>("all");
  const [jobTypeBoardFilter, setJobTypeBoardFilter] = useState<string>("all");
  const [myProfession, setMyProfession] = useState<string | null>(null);
  const [userApplicationIds, setUserApplicationIds] = useState<string[]>([]);
  const [detailJob, setDetailJob] = useState<any | null>(null);
  const [companyProfileJob, setCompanyProfileJob] = useState<any | null>(null);
  const [isApplyingJobId, setIsApplyingJobId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchWallet();
      fetchStats();
      fetchApplications();
      fetchStatusAlerts();
      fetchJobMatchAlerts();
      fetchBoardJobs();
      fetchSeekerProfession();
      fetchUserApplicationIds();
    }
  }, [user]);

  const filteredBoardJobs = useMemo(() => {
    let list = boardJobs;
    const q = jobSearchTitle.trim().toLowerCase();
    if (q) list = list.filter((j: any) => (j.title || "").toLowerCase().includes(q));

    if (professionBoardFilter === "my_profession") {
      if (myProfession?.trim()) {
        list = list.filter((j: any) => areasFocusMatch(j.area_of_business, myProfession));
      } else {
        list = [];
      }
    } else if (professionBoardFilter !== "all") {
      list = list.filter((j: any) => areasFocusMatch(j.area_of_business, professionBoardFilter));
    }

    if (jobTypeBoardFilter !== "all") {
      list = list.filter((j: any) => j.job_type === jobTypeBoardFilter);
    }

    return list;
  }, [boardJobs, jobSearchTitle, professionBoardFilter, myProfession, jobTypeBoardFilter]);

  const fetchBoardJobs = async () => {
    setLoadingBoardJobs(true);
    try {
      const list = await fetchOpenJobsWithEmployer(supabase);
      setBoardJobs(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBoardJobs(false);
    }
  };

  const fetchSeekerProfession = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("profession_or_study")
      .eq("id", user.id)
      .maybeSingle();
    setMyProfession((data as { profession_or_study?: string | null } | null)?.profession_or_study ?? null);
  };

  const fetchUserApplicationIds = async () => {
    const { data } = await supabase.from("applications").select("job_id").eq("user_id", user.id);
    setUserApplicationIds(data?.map((a) => a.job_id) ?? []);
  };

  const handleApplyFromBoard = async (jobId: string) => {
    if (expiresAt && new Date(expiresAt) < new Date()) {
      showToast("Your tokens have expired. Please top up to reactivate.", "error");
      return;
    }

    setIsApplyingJobId(jobId);
    try {
      const { data, error } = await supabase.rpc("apply_to_job", {
        p_job_id: jobId,
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data.success) {
        showToast("Application submitted successfully!");
        setDetailJob(null);
        await fetchWallet();
        await fetchUserApplicationIds();
        await fetchApplications();
        await fetchStats();

        fetch("/api/auth/resend-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, type: "application_confirmation", jobId }),
        }).catch(console.error);

        fetch("/api/applications/notify-employer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, seekerUserId: user.id }),
        }).catch(console.error);
      } else {
        showToast(data.error || "Failed to apply", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Network error occurred", "error");
    } finally {
      setIsApplyingJobId(null);
    }
  };

  const fetchJobMatchAlerts = async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, created_at, payload")
      .eq("user_id", user.id)
      .eq("type", "job_match")
      .order("created_at", { ascending: false })
      .limit(8);
    if (!error && data) setJobMatchAlerts(data as any);
  };

  const fetchStatusAlerts = async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, created_at, payload")
      .eq("user_id", user.id)
      .eq("type", "application_status")
      .order("created_at", { ascending: false })
      .limit(8);
    if (!error && data) setStatusAlerts(data as any);
  };

  function dashStatusIcon(status: string) {
    if (status === "rejected") return { I: XCircle, ring: "bg-red-500/10 text-red-400" };
    if (status === "offer") return { I: Sparkles, ring: "bg-amber-500/10 text-amber-300" };
    if (["shortlisted", "qualified", "interview"].includes(status)) {
      return { I: CheckCircle, ring: "bg-emerald-500/10 text-emerald-400" };
    }
    return { I: Clock, ring: "bg-slate-500/10 text-slate-300" };
  }

  function dashStatusPill(status: string) {
    const tone = applicationStatusTone(status);
    if (tone === "negative") return "bg-red-500/10 text-red-400 border-red-500/20";
    if (tone === "positive") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (status === "reviewing") return "bg-slate-500/10 text-slate-300 border-slate-500/20";
    return "bg-amber-500/10 text-amber-300 border-amber-500/20";
  }

  const fetchApplications = async () => {
    setLoadingApps(true);
    try {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id,
          status,
          notes,
          created_at,
          updated_at,
          job:job_id (
            id,
            title,
            job_type
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setApplications(data as any);
    } catch (error: any) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoadingApps(false);
    }
  };

  const fetchWallet = async () => {
    const { data } = await supabase
      .from("wallets")
      .select("token_balance, expires_at")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setBalance(data.token_balance);
      setExpiresAt(data.expires_at);
    }
  };

  const fetchStats = async () => {
    const { count } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { data: wallet } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    let spent = 0;
    if (wallet?.id) {
      const { data: deductions } = await supabase
        .from("transactions")
        .select("tokens_added")
        .eq("wallet_id", wallet.id)
        .eq("type", "application");

      spent =
        deductions?.reduce(
          (acc, curr) => acc + Math.abs(Number(curr.tokens_added)),
          0
        ) || 0;
    }

    setStats({ applications: count ?? 0, spent });
  };

  return (
    <>
      <CompanyProfileSeekerModal
        open={!!companyProfileJob}
        onClose={() => setCompanyProfileJob(null)}
        jobTitle={companyProfileJob?.title ?? null}
        employer={companyProfileJob?.employer ?? null}
      />

      <JobDetailModal
        job={detailJob}
        onClose={() => setDetailJob(null)}
        onApply={async (jobId) => {
          await handleApplyFromBoard(jobId);
        }}
        isApplying={detailJob ? isApplyingJobId === detailJob.id : false}
        hasApplied={detailJob ? userApplicationIds.includes(detailJob.id) : false}
        hideApply={false}
        onViewCompany={() => {
          if (detailJob) setCompanyProfileJob(detailJob);
        }}
      />

    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4">
          <WalletDashboard
            balance={balance}
            onBalanceRefresh={fetchWallet}
            userId={user.id}
            expiresAt={expiresAt}
          />
        </div>

        <div className="lg:col-span-8 space-y-8">
          {jobMatchAlerts.length > 0 ? (
            <div className="p-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <h3 className="text-sm font-bold">Jobs matching your profile</h3>
              </div>
              <ul className="space-y-2">
                {jobMatchAlerts.map((n) => {
                  const p = n.payload as {
                    job_title?: string;
                    job_id?: string;
                    area_of_business?: string;
                  };
                  return (
                    <li
                      key={n.id}
                      className="text-xs text-zinc-400 border-l-2 border-emerald-500/40 pl-3 py-1"
                    >
                      <Link
                        to="/"
                        state={{ highlightJobId: p.job_id }}
                        className="text-zinc-200 font-medium hover:text-emerald-300"
                      >
                        {p.job_title || "New listing"}
                      </Link>
                      {(p as { profession_sought?: string }).profession_sought || p.area_of_business ? (
                        <span className="text-zinc-500">
                          {" "}
                          ·{" "}
                          {(p as { profession_sought?: string }).profession_sought ||
                            p.area_of_business}
                        </span>
                      ) : null}
                      <span className="text-zinc-600 ml-2">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Link
                to="/"
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300"
              >
                Open job board
              </Link>
            </div>
          ) : null}

          {statusAlerts.length > 0 ? (
            <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <Bell className="w-4 h-4" />
                <h3 className="text-sm font-bold">Application updates</h3>
              </div>
              <ul className="space-y-2">
                {statusAlerts.map((n) => {
                  const p = n.payload as {
                    job_title?: string;
                    status?: string;
                  };
                  return (
                    <li
                      key={n.id}
                      className="text-xs text-zinc-400 border-l-2 border-emerald-500/30 pl-3 py-1"
                    >
                      <span className="text-zinc-200 font-medium">{p.job_title || "Job"}</span>
                      {" → "}
                      <span className="text-emerald-400/90">
                        {applicationStatusLabel(p.status || "pending")}
                      </span>
                      <span className="text-zinc-600 ml-2">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Link
                to="/dashboard/applications"
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300"
              >
                Open full history
              </Link>
            </div>
          ) : null}

          <Link
            to="/dashboard/profile"
            className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <UserCircle className="w-10 h-10 text-emerald-400" />
              <div>
                <p className="font-bold text-white group-hover:text-emerald-300 transition-colors">
                  My profile
                </p>
                <p className="text-xs text-zinc-500">
                  Add profession, education, experience, and skills — and get alerts when jobs match
                  your field.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider shrink-0">
              Edit
            </span>
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 rounded-3xl border border-white/10 bg-white/5"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-zinc-500 text-sm font-medium uppercase tracking-wider">Total Applications</p>
                  <h3 className="text-3xl font-bold">{stats.applications}</h3>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-8 rounded-3xl border border-white/10 bg-white/5"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-zinc-500 text-sm font-medium uppercase tracking-wider">Tokens Spent</p>
                  <h3 className="text-3xl font-bold">{stats.spent}</h3>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Browse openings</h3>
                  <p className="text-sm text-zinc-500 mt-0.5">
                    Search by title and filter by role focus or job type. Same listings as the home
                    board.
                  </p>
                </div>
              </div>
              <Link
                to="/"
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider shrink-0"
              >
                Open full job board
              </Link>
            </div>

            <div className="flex flex-col gap-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="search"
                  value={jobSearchTitle}
                  onChange={(e) => setJobSearchTitle(e.target.value)}
                  placeholder="Search by job title…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">
                    Profession (job listing)
                  </label>
                  <select
                    value={professionBoardFilter}
                    onChange={(e) => setProfessionBoardFilter(e.target.value)}
                    className="select-themed"
                  >
                    <option value="all">All areas</option>
                    <option value="my_profession">My profession (profile)</option>
                    {BUSINESS_AREAS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  {professionBoardFilter === "my_profession" && !myProfession?.trim() ? (
                    <p className="text-xs text-amber-500/90">
                      Set <strong className="text-amber-400">Profession or area of study</strong>{" "}
                      in{" "}
                      <Link to="/dashboard/profile" className="underline hover:text-amber-300">
                        My profile
                      </Link>{" "}
                      to use this filter.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">
                    Job type
                  </label>
                  <select
                    value={jobTypeBoardFilter}
                    onChange={(e) => setJobTypeBoardFilter(e.target.value)}
                    className="select-themed"
                  >
                    <option value="all">All types</option>
                    <option value="Remote">Remote</option>
                    <option value="Onsite">Onsite</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
              </div>
            </div>

            {loadingBoardJobs ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              </div>
            ) : filteredBoardJobs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredBoardJobs.map((job: any) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onApply={handleApplyFromBoard}
                    onViewDetails={(j) => setDetailJob(j)}
                    onViewCompany={(j) => setCompanyProfileJob(j)}
                    isApplying={isApplyingJobId === job.id}
                    isGuest={false}
                    hasApplied={userApplicationIds.includes(job.id)}
                    hideApply={false}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
                <Briefcase className="w-12 h-12 text-zinc-600 mx-auto mb-3 opacity-30" />
                <p className="text-zinc-400 text-sm">
                  {boardJobs.length === 0
                    ? "No open listings right now."
                    : "No jobs match your search or filters."}
                </p>
                {boardJobs.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setJobSearchTitle("");
                      setProfessionBoardFilter("all");
                      setJobTypeBoardFilter("all");
                    }}
                    className="mt-4 text-xs font-bold text-emerald-400 hover:text-emerald-300"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-emerald-500" />
                <h3 className="text-xl font-bold">My Applications</h3>
              </div>
              <Link
                to="/dashboard/applications"
                className="inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-xl border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              >
                <ClipboardList className="w-4 h-4" />
                Full history and employer notes
              </Link>
            </div>
            
            {loadingApps ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
              </div>
            ) : applications.length > 0 ? (
              <div className="space-y-4">
                {applications.map((app) => {
                  const st = app.status || "pending";
                  const { I: StatusIcon, ring } = dashStatusIcon(st);
                  return (
                  <div
                    key={app.id}
                    className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            ring
                          )}
                        >
                          <StatusIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white">{app.job.title}</p>
                          <p className="text-xs text-zinc-500">
                            {app.job.job_type ? `${app.job.job_type} · ` : ""}
                            {new Date(app.created_at).toLocaleDateString()}
                          </p>
                          {(app.notes || "").trim() ? (
                            <p className="text-xs text-emerald-400/90 mt-2 flex items-start gap-1.5 line-clamp-2">
                              <MessageSquareText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span>
                                <span className="text-zinc-500 font-medium">Employer: </span>
                                {(app.notes || "").trim()}
                              </span>
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border",
                            dashStatusPill(st)
                          )}
                        >
                          {applicationStatusLabel(st)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAppId((id) => (id === app.id ? null : app.id))
                          }
                          className="p-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white"
                          aria-label="Toggle messages"
                        >
                          {expandedAppId === app.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    {expandedAppId === app.id && (
                      <div className="px-4 pb-4 border-t border-white/5 pt-3">
                        <ApplicationThread applicationId={app.id} currentUserId={user.id} />
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-500 text-sm italic">
                  You haven't applied for any jobs yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
