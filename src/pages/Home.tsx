import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { JobCard } from "../components/JobCard";
import { WalletDashboard } from "../components/WalletDashboard";
import { RefreshCw, LayoutDashboard, Briefcase } from "lucide-react";

export function HomePage({ user, showToast }: { user: any, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [balance, setBalance] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState<string | null>(null);
  const [isTopupLoading, setIsTopupLoading] = useState(false);
  const [userApplications, setUserApplications] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchJobs();
    if (user) {
      fetchWallet(user.id);
      fetchUserApplications(user.id);
    }
  }, [user]);

  const fetchJobs = async () => {
    const { data, error } = await supabase.from("jobs").select("*").order('created_at', { ascending: false });
    if (!error && data) {
      setJobs(data);
    }
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
        fetchWallet(user.id);
        fetchUserApplications(user.id);
        
        // Trigger confirmation email
        fetch("/api/auth/resend-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, type: 'application_confirmation', jobId }),
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

  const handleTopup = async () => {
    if (!user) return;

    setIsTopupLoading(true);
    try {
      const response = await fetch("/api/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      const result = await response.json();

      if (response.ok) {
        setBalance(result.newBalance);
        showToast("Tokens added successfully!");
      } else {
        showToast(result.error || "Topup failed", "error");
      }
    } catch (error) {
      showToast("Network error occurred", "error");
    } finally {
      setIsTopupLoading(false);
    }
  };

  const filteredJobs = filter === "all" 
    ? jobs 
    : jobs.filter(job => job.job_type === filter);

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Available Jobs</h2>
              <p className="text-zinc-500 mt-1">Find your next career move and apply with tokens.</p>
            </div>
            <div className="flex items-center gap-3">
              <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
              >
                <option value="all">All Types</option>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredJobs.length > 0 ? (
              filteredJobs.map((job) => (
                <JobCard 
                  key={job.id} 
                  job={job} 
                  onApply={handleApply}
                  isApplying={isApplying === job.id}
                  isGuest={!user}
                  hasApplied={userApplications.includes(job.id)}
                  hideApply={user?.user_metadata?.role === 'employer'}
                />
              ))
            ) : (
              <div className="col-span-full p-12 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] text-center">
                <Briefcase className="w-12 h-12 text-zinc-600 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-zinc-400">No jobs available right now</h3>
                <p className="text-sm text-zinc-500 mt-2">Check back later for new opportunities.</p>
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
                onTopup={handleTopup}
                isTopupLoading={isTopupLoading}
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
  );
}
