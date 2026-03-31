import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { WalletDashboard } from "../components/WalletDashboard";
import { ApplicationThread } from "../components/ApplicationThread";
import { motion } from "motion/react";
import { History, Briefcase, CheckCircle, Clock, AlertCircle, Loader2, XCircle, ChevronDown, ChevronUp, UserCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface UserApplication {
  id: string;
  status: string;
  created_at: string;
  job: {
    title: string;
  };
}

export function DashboardPage({ user, showToast }: { user: any, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [balance, setBalance] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [stats, setStats] = useState({ applications: 0, spent: 0 });
  const [applications, setApplications] = useState<UserApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWallet();
      fetchStats();
      fetchApplications();
    }
  }, [user]);

  const fetchApplications = async () => {
    setLoadingApps(true);
    try {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id,
          status,
          created_at,
          job:job_id (title)
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
      .select("*", { count: 'exact', head: true })
      .eq("user_id", user.id);
    
    const { data: txs } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (txs) {
      const { data: deductions } = await supabase
        .from("transactions")
        .select("tokens_added")
        .eq("wallet_id", txs.id)
        .eq("type", "application");

      const spent =
        deductions?.reduce((acc, curr) => acc + Math.abs(curr.tokens_added), 0) || 0;
      setStats({ applications: count || 0, spent });
    }
  };

  return (
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
                  Add education, experience, and skills so employers see them when you apply.
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

          <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-5 h-5 text-emerald-500" />
              <h3 className="text-xl font-bold">My Applications</h3>
            </div>
            
            {loadingApps ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
              </div>
            ) : applications.length > 0 ? (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            app.status === "shortlisted"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : app.status === "rejected"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-yellow-500/10 text-yellow-400"
                          )}
                        >
                          {app.status === "shortlisted" ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : app.status === "rejected" ? (
                            <XCircle className="w-5 h-5" />
                          ) : (
                            <Clock className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white">{app.job.title}</p>
                          <p className="text-xs text-zinc-500">
                            {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border",
                            app.status === "shortlisted"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : app.status === "rejected"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                          )}
                        >
                          {app.status || "pending"}
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
                ))}
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
  );
}
