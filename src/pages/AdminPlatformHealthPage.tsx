import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Loader2, Activity, AlertTriangle, ChevronRight } from "lucide-react";
import { apiFetch } from "../lib/apiFetch";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { cn } from "../lib/utils";

type PromptStat = {
  prompt_id: string;
  headline: string;
  series_title: string;
  total_submissions: number;
  passed: number;
  failed: number;
  pending: number;
  pass_rate: number;
  reward_kes: number;
  submit_cost_tokens: number;
  total_rewarded_kes: number;
  total_revenue_tokens: number;
};

type HealthData = {
  total_revenue_kes: number;
  total_rewards_kes: number;
  health_ratio: number | null;
  health_status: "healthy" | "acceptable" | "warning" | "critical";
  prompt_stats: PromptStat[];
  reward_cap_config: {
    kes_per_token: number;
    margin: number;
    target_pass_rate: number;
  };
};

const STATUS_CONFIG = {
  healthy: { label: "Healthy", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  acceptable: { label: "Acceptable", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" },
  warning: { label: "Warning", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  critical: { label: "Critical", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
};

export function AdminPlatformHealthPage({
  showToast,
}: {
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const navigate = useNavigate();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/platform-health");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Failed to load");
      setData(j as HealthData);
    } catch (e: any) {
      showToast(e.message || "Could not load health data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-12 text-white text-center">
        <p className="text-zinc-500">Could not load platform health data.</p>
      </main>
    );
  }

  const cfg = STATUS_CONFIG[data.health_status];
  const chartData = [
    { name: "Revenue", value: data.total_revenue_kes, fill: "#10b981" },
    { name: "Rewards", value: data.total_rewards_kes, fill: "#f59e0b" },
  ];

  const targetPassRate = data.reward_cap_config.target_pass_rate;
  const sortedStats = [...data.prompt_stats].sort((a, b) => b.pass_rate - a.pass_rate);

  return (
    <main className="max-w-6xl mx-auto px-6 py-12 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-black">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Platform Health</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              Revenue vs rewards, pass rates, and sustainability metrics.
            </p>
          </div>
        </div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          Admin home
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("rounded-2xl border p-6", cfg.bg)}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
            Health Ratio
          </p>
          <p className={cn("text-4xl font-black", cfg.color)}>
            {data.health_ratio !== null ? data.health_ratio.toFixed(2) : "N/A"}
          </p>
          <p className={cn("text-sm font-bold mt-1", cfg.color)}>{cfg.label}</p>
          <p className="text-xs text-zinc-500 mt-2">
            Target: &ge; 2.0 (revenue / rewards)
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
            Total Revenue
          </p>
          <p className="text-3xl font-black text-emerald-400">
            {data.total_revenue_kes.toLocaleString("en-KE")}
          </p>
          <p className="text-xs text-zinc-500 mt-1">KES from token purchases</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
            Total Rewards Paid
          </p>
          <p className="text-3xl font-black text-amber-400">
            {data.total_rewards_kes.toLocaleString("en-KE")}
          </p>
          <p className="text-xs text-zinc-500 mt-1">KES credited to seekers</p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 mb-8"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">
          Revenue vs Rewards
        </p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" barSize={32}>
              <XAxis type="number" tick={{ fill: "#71717a", fontSize: 12 }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: "#a1a1aa", fontSize: 13 }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  color: "#fff",
                  fontSize: "13px",
                }}
                formatter={(value: number) => [`KES ${value.toLocaleString("en-KE")}`, ""]}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 mb-8"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          Reward Cap Config
        </p>
        <div className="flex flex-wrap gap-6 text-sm text-zinc-300">
          <span>
            <span className="text-zinc-500">Token price:</span>{" "}
            <span className="font-bold">{data.reward_cap_config.kes_per_token} KES</span>
          </span>
          <span>
            <span className="text-zinc-500">Margin:</span>{" "}
            <span className="font-bold">{(data.reward_cap_config.margin * 100).toFixed(0)}%</span>
          </span>
          <span>
            <span className="text-zinc-500">Target pass rate:</span>{" "}
            <span className="font-bold">{(targetPassRate * 100).toFixed(0)}%</span>
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
      >
        <div className="p-5 border-b border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Per-prompt pass rates
          </p>
        </div>
        {sortedStats.length === 0 ? (
          <p className="text-center text-zinc-500 py-12">No prompts with submissions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 uppercase border-b border-white/5">
                  <th className="px-5 py-3">Prompt</th>
                  <th className="px-5 py-3">Submissions</th>
                  <th className="px-5 py-3">Pass rate</th>
                  <th className="px-5 py-3">Reward</th>
                  <th className="px-5 py-3">Cost</th>
                  <th className="px-5 py-3">Total rewarded</th>
                  <th className="px-5 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {sortedStats.map((s) => {
                  const overTarget = s.pass_rate > targetPassRate && s.total_submissions > 0;
                  return (
                    <tr
                      key={s.prompt_id}
                      onClick={() => navigate(`/admin/prompts/${s.prompt_id}/review`)}
                      className={cn(
                        "border-b border-white/5 hover:bg-white/[0.04] cursor-pointer transition-colors",
                        overTarget && "bg-amber-500/[0.04]"
                      )}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {overTarget && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          <div>
                            <p className="font-medium truncate max-w-[240px]">{s.headline}</p>
                            <p className="text-[10px] text-zinc-600">{s.series_title}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-zinc-400">
                        {s.total_submissions}{" "}
                        <span className="text-zinc-600">
                          ({s.passed}P / {s.failed}F / {s.pending}W)
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            "font-bold",
                            overTarget ? "text-amber-400" : "text-emerald-400"
                          )}
                        >
                          {(s.pass_rate * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-zinc-400">
                        {s.reward_kes.toLocaleString("en-KE")} KES
                      </td>
                      <td className="px-5 py-3 text-zinc-400">{s.submit_cost_tokens} tokens</td>
                      <td className="px-5 py-3 text-amber-400">
                        {s.total_rewarded_kes.toLocaleString("en-KE")} KES
                      </td>
                      <td className="px-5 py-3 text-zinc-500">
                        <ChevronRight className="w-4 h-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </main>
  );
}
