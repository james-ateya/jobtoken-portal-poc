import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fetchOpenJobsWithEmployer } from "../lib/fetchOpenJobs";
import { BUSINESS_AREAS, areasFocusMatch } from "../lib/businessAreas";
import { JobCard } from "../components/JobCard";
import { JobDetailModal } from "../components/JobDetailModal";
import { CompanyProfileSeekerModal } from "../components/CompanyProfileSeekerModal";
import { WalletDashboard } from "../components/WalletDashboard";
import { RefreshCw, LayoutDashboard, Briefcase } from "lucide-react";

export function HomePage({ user, showToast }: { user: any, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [professionFilter, setProfessionFilter] = useState<string>("all");
  const [myProfession, setMyProfession] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState<string | null>(null);
  const [userApplications, setUserApplications] = useState<string[]>([]);
  const [detailJob, setDetailJob] = useState<any | null>(null);
  const [companyProfileJob, setCompanyProfileJob] = useState<any | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchJobs();
    if (user) {
      fetchWallet(user.id);
      fetchUserApplications(user.id);
      fetchSeekerProfession(user.id);
    } else {
      setMyProfession(null);
    }
  }, [user]);

  const fetchSeekerProfession = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("profession_or_study")
      .eq("id", userId)
      .maybeSingle();
    setMyProfession((data as { profession_or_study?: string | null } | null)?.profession_or_study ?? null);
  };

  useEffect(() => {
    const id = (location.state as { highlightJobId?: string } | null)?.highlightJobId;
    if (!id || jobs.length === 0) return;
    const j = jobs.find((x) => x.id === id);
    if (j) setDetailJob(j);
    navigate(".", { replace: true, state: {} });
  }, [jobs, location.state, navigate]);

  const fetchJobs = async () => {
    const active = await fetchOpenJobsWithEmployer(supabase);
    setJobs(active);
  };

  const fetchUserApplications = async (userId: string) => {
    const { data } = await supabase
      .from("applications")
      .select("job_id")
      .eq("user_id", userId);
    if (data) setUserApplications(data.map(a => a.job_id));
  };

  const fetchWallet = async (userId: string) => {
    const { data } = await supabase
      .from("wallets")
      .select("token_balance, expires_at")
      .eq("user_id", userId)
      .single();
    if (data) {
      setBalance(data.token_balance);
      setExpiresAt(data.expires_at);
    }
  };

  const handleApply = async (jobId: string) => {
    if (!user) {
      navigate("/login");
      return;
    }

    // Client-side expiry check for better UX
    if (expiresAt && new Date(expiresAt) < new Date()) {
      showToast("Your tokens have expired. Please top up to reactivate.", "error");
      return;
    }

    setIsApplying(jobId);
    try {
      // Use the RPC for atomic transaction
      const { data, error } = await supabase.rpc('apply_to_job', {
        p_job_id: jobId,
        p_user_id: user.id
      });

      if (error) throw error;

      if (data.success) {
        showToast("Application submitted successfully!");
        setDetailJob(null);
        fetchWallet(user.id);
        fetchUserApplications(user.id);

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
    } catch (error: any) {
      showToast(error.message || "Network error occurred", "error");
    } finally {
      setIsApplying(null);
    }
  };

  const filteredJobs = useMemo(() => {
    let list = jobs;
    if (filter !== "all") list = list.filter((job) => job.job_type === filter);

    if (professionFilter === "my_profession") {
      if (myProfession?.trim()) {
        list = list.filter((j: any) => areasFocusMatch(j.area_of_business, myProfession));
      } else {
        list = [];
      }
    } else if (professionFilter !== "all") {
      list = list.filter((j: any) => areasFocusMatch(j.area_of_business, professionFilter));
    }

    return list;
  }, [jobs, filter, professionFilter, myProfession]);

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
          await handleApply(jobId);
        }}
        isApplying={detailJob ? isApplying === detailJob.id : false}
        hasApplied={detailJob ? userApplications.includes(detailJob.id) : false}
        hideApply={user?.user_metadata?.role === "employer"}
        onViewCompany={() => {
          if (detailJob) setCompanyProfileJob(detailJob);
        }}
      />
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Available Jobs</h2>
              <p className="text-zinc-500 mt-1">Find your next career move and apply with tokens.</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <select
                value={professionFilter}
                onChange={(e) => setProfessionFilter(e.target.value)}
                className="select-themed !py-2 min-w-[12rem] flex-1 sm:flex-initial"
              >
                <option value="all">All professions</option>
                {user ? (
                  <option value="my_profession">My profession (profile)</option>
                ) : null}
                {BUSINESS_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="select-themed !py-2 min-w-[10rem] flex-1 sm:flex-initial"
              >
                <option value="all">All job types</option>
                <option value="Remote">Remote</option>
                <option value="Onsite">Onsite</option>
                <option value="Online">Online</option>
              </select>
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-400">
                <RefreshCw className="w-3 h-3" />
                Live
              </div>
            </div>
          </div>

          {professionFilter === "my_profession" && user && !myProfession?.trim() ? (
            <p className="text-sm text-amber-500/90 -mt-4">
              Set your{" "}
              <Link to="/dashboard/profile" className="underline hover:text-amber-400">
                profession or area of study
              </Link>{" "}
              to use this filter, or choose a specific profession above.
            </p>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredJobs.length > 0 ? (
              filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onApply={handleApply}
                  onViewDetails={user ? (j) => setDetailJob(j) : undefined}
                  onViewCompany={(j) => setCompanyProfileJob(j)}
                  isApplying={isApplying === job.id}
                  isGuest={!user}
                  hasApplied={userApplications.includes(job.id)}
                  hideApply={user?.user_metadata?.role === "employer"}
                />
              ))
            ) : (
              <div className="col-span-full p-12 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] text-center">
                <Briefcase className="w-12 h-12 text-zinc-600 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-zinc-400">No jobs match your filters</h3>
                <p className="text-sm text-zinc-500 mt-2">
                  {jobs.length === 0
                    ? "Check back later for new opportunities."
                    : "Try another profession or job type."}
                </p>
                {jobs.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFilter("all");
                      setProfessionFilter("all");
                    }}
                    className="mt-4 text-xs font-bold text-emerald-400 hover:text-emerald-300"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="sticky top-32">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-emerald-500" />
              Dashboard
            </h2>
            
            {user ? (
              <WalletDashboard
                balance={balance}
                onBalanceRefresh={() => fetchWallet(user.id)}
                userId={user.id}
                expiresAt={expiresAt}
              />
            ) : (
              <div className="p-8 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] text-center">
                <h3 className="font-medium mb-2">Sign in to view wallet</h3>
                <p className="text-sm text-zinc-500 mb-6">Connect your account to manage tokens and track applications.</p>
                <button 
                  onClick={() => window.location.href = "/login"}
                  className="w-full py-3 bg-white text-black rounded-xl font-medium hover:bg-emerald-400 transition-colors"
                >
                  Sign In Now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
