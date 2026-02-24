import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { motion } from "motion/react";
import { 
  Shield, 
  TrendingUp, 
  Users, 
  Briefcase, 
  FileText, 
  Trash2, 
  Search, 
  PlusCircle, 
  Loader2, 
  ArrowRight,
  DollarSign,
  Clock,
  Download,
  BarChart3,
  AlertTriangle,
  Activity
} from "lucide-react";
import { cn } from "../lib/utils";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from 'recharts';

interface PlatformStats {
  total_revenue: number;
  active_seekers: number;
  registered_employers: number;
  total_applications: number;
}

interface AdvancedStats {
  token_liability: number;
  revenue_per_category: Record<string, number>;
  avg_time_to_hire: string;
}

interface AnalyticsReport {
  id: string;
  title: string;
  category: string;
  employer: string;
  applicant_count: number;
  posted_at: string;
}

interface Job {
  id: string;
  title: string;
  job_type: string;
  posted_by: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface Transaction {
  id: string;
  tokens_added: number;
  type: string;
  reference_id: string;
  created_at: string;
  wallet: {
    profiles: {
      email: string;
    };
  };
}

export function AdminDashboard({ user, showToast }: { user: any, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [advancedStats, setAdvancedStats] = useState<AdvancedStats | null>(null);
  const [analyticsReport, setAnalyticsReport] = useState<AnalyticsReport[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ transactions: any[], profiles: any[] } | null>(null);
  const [grantingTokens, setGrantingTokens] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Fetch Stats from API
      const [statsRes, advStatsRes, analyticsRes, chartRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/advanced-stats"),
        fetch("/api/admin/analytics-report"),
        fetch("/api/admin/chart-data")
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (advStatsRes.ok) setAdvancedStats(await advStatsRes.json());
      if (analyticsRes.ok) setAnalyticsReport(await analyticsRes.json());
      if (chartRes.ok) setChartData(await chartRes.json());

      // Fetch Jobs
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('*, profiles:posted_by(full_name, email)')
        .order('created_at', { ascending: false });
      if (jobsData) setJobs(jobsData as any);

      // Fetch Transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('*, wallet:wallet_id(profiles:user_id(email))')
        .order('created_at', { ascending: false })
        .limit(20);
      if (txData) setTransactions(txData as any);

    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalSearch = async (val: string) => {
    setGlobalSearch(val);
    if (val.length < 3) {
      setSearchResults(null);
      return;
    }
    try {
      const res = await fetch(`/api/admin/global-search?query=${val}`);
      if (res.ok) {
        setSearchResults(await res.json());
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/admin/export-csv");
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financial_log_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("Export successful");
      }
    } catch (error) {
      showToast("Export failed", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this job post?")) return;
    
    setDeletingJobId(jobId);
    try {
      const response = await fetch("/api/admin/jobs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      if (response.ok) {
        setJobs(jobs.filter(j => j.id !== jobId));
        setAnalyticsReport(analyticsReport.filter(r => r.id !== jobId));
        showToast("Job deleted successfully");
      } else {
        const err = await response.json();
        throw new Error(err.error);
      }
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setDeletingJobId(null);
    }
  };

  const handleGrantTokens = async () => {
    if (!searchEmail) return;
    setGrantingTokens(true);
    try {
      const response = await fetch("/api/admin/tokens/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: searchEmail, amount: 5 }),
      });

      if (response.ok) {
        showToast(`Successfully granted 5 tokens to ${searchEmail}`);
        setSearchEmail("");
        fetchAdminData();
      } else {
        const err = await response.json();
        throw new Error(err.error);
      }
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setGrantingTokens(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-black">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Control Center</h1>
            <p className="text-zinc-500 mt-1">Platform-wide monitoring and moderation.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              value={globalSearch}
              onChange={(e) => handleGlobalSearch(e.target.value)}
              placeholder="Search Ref ID or Email..."
              className="bg-white/5 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors w-64"
            />
            {searchResults && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-50 p-4 max-h-96 overflow-y-auto">
                {searchResults.profiles.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 text-emerald-500">Users</p>
                    {searchResults.profiles.map(p => (
                      <div 
                        key={p.id} 
                        className="p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                        onClick={() => {
                          setSearchEmail(p.email);
                          setSearchResults(null);
                          setGlobalSearch("");
                          showToast(`Selected user: ${p.email}`);
                        }}
                      >
                        <p className="text-sm font-bold">{p.full_name}</p>
                        <p className="text-xs text-zinc-500">{p.email}</p>
                      </div>
                    ))}
                  </div>
                )}
                {searchResults.transactions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 text-blue-500">Transactions</p>
                    {searchResults.transactions.map(t => (
                      <div key={t.id} className="p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                        <p className="text-sm font-mono text-white">{t.reference_id}</p>
                        <p className="text-xs text-zinc-500">{t.wallet?.profiles?.email}</p>
                        <p className="text-[10px] text-zinc-600">{t.type} • {new Date(t.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
                {searchResults.profiles.length === 0 && searchResults.transactions.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center py-4">No results found</p>
                )}
              </div>
            )}
          </div>
          <button 
            onClick={handleExportCSV}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm font-bold text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Financial Log (CSV)
          </button>
        </div>
      </div>

      {/* Stats Grid - Vital Signs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard 
          title="Active Token Liability" 
          value={advancedStats?.token_liability || 0} 
          icon={<Activity className="w-5 h-5" />} 
          color="text-blue-400"
          subtitle="Total unspent tokens"
        />
        <StatCard 
          title="Avg Time to Hire" 
          value={`${advancedStats?.avg_time_to_hire || 0} Days`} 
          icon={<Clock className="w-5 h-5" />} 
          color="text-purple-400"
          subtitle="Shortlisted vs Applied"
        />
        <StatCard 
          title="Top Revenue Category" 
          value={Object.entries(advancedStats?.revenue_per_category || {}).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || "N/A"} 
          icon={<DollarSign className="w-5 h-5" />} 
          color="text-emerald-400"
          subtitle={`Ksh ${Object.entries(advancedStats?.revenue_per_category || {}).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[1] || 0} Revenue`}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        <div className="lg:col-span-8 p-8 rounded-3xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              Platform Growth (Last 7 Days)
            </h3>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-zinc-400">Revenue (Ksh)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-zinc-400">Applications</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#ffffff40" 
                  fontSize={10} 
                  tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis stroke="#ffffff40" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                <Area type="monotone" dataKey="applications" stroke="#3b82f6" fillOpacity={1} fill="url(#colorApps)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 p-8 rounded-3xl border border-white/10 bg-white/[0.02]">
          <h3 className="text-lg font-bold mb-6">Revenue by Category</h3>
          <div className="space-y-6">
            {Object.entries(advancedStats?.revenue_per_category || {}).map(([cat, rev]) => (
              <div key={cat}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-zinc-400 font-medium">{cat}</span>
                  <span className="text-white font-bold">Ksh {rev}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ((rev as number) / (stats?.total_revenue || 1)) * 100)}%` }}
                    className="h-full bg-emerald-500 rounded-full"
                  />
                </div>
              </div>
            ))}
            {Object.keys(advancedStats?.revenue_per_category || {}).length === 0 && (
              <p className="text-zinc-500 text-sm italic text-center py-8">No category data available</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Main Content */}
        <div className="lg:col-span-8 space-y-12">
          {/* Job Performance Report */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Job Performance Report
              </h2>
            </div>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Job Details</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Employer</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Applicants</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsReport.map((report) => (
                      <tr key={report.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-white">{report.title}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{report.category}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-zinc-300">{report.employer}</p>
                          <p className="text-[10px] text-zinc-500">{new Date(report.posted_at).toLocaleDateString()}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold",
                              report.applicant_count > 50 ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/5 text-zinc-400 border border-white/10"
                            )}>
                              {report.applicant_count}
                            </span>
                            {report.applicant_count > 50 && (
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDeleteJob(report.id)}
                            disabled={deletingJobId === report.id}
                            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                          >
                            {deletingJobId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Transaction Log */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500" />
                Recent Transactions
              </h2>
            </div>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">User</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Amount</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Ref ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-white/5">
                        <td className="px-6 py-4">
                          <p className="text-sm text-white">{tx.wallet?.profiles?.email || 'Unknown'}</p>
                          <p className="text-[10px] text-zinc-500">{new Date(tx.created_at).toLocaleString()}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "font-mono font-bold",
                            tx.tokens_added > 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            {tx.tokens_added > 0 ? '+' : ''}{tx.tokens_added}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[10px] font-mono text-zinc-500">{tx.reference_id}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar Actions */}
        <div className="lg:col-span-4 space-y-8">
          <section className="p-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-500" />
              Manual Adjustment
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">User Email</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input 
                    type="email" 
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="search@user.com"
                  />
                </div>
              </div>
              <button 
                onClick={handleGrantTokens}
                disabled={grantingTokens || !searchEmail}
                className="w-full py-4 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {grantingTokens ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
                Grant 5 Tokens
              </button>
              <p className="text-[10px] text-zinc-500 text-center uppercase tracking-widest font-bold">
                Action will be logged in transactions
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function StatCard({ title, value, icon, color, subtitle }: { title: string, value: string | number, icon: React.ReactNode, color: string, subtitle?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-3xl border border-white/10 bg-white/5"
    >
      <div className="flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center", color)}>
          {icon}
        </div>
        <div>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{title}</p>
          <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
          {subtitle && <p className="text-[10px] text-zinc-600 mt-1 font-medium">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
}
