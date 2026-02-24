import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, XCircle, Loader2, Mail, User, Briefcase, MessageSquare } from "lucide-react";
import { cn } from "../lib/utils";

interface Application {
  id: string;
  status: string;
  notes: string;
  created_at: string;
  job_title: string;
  applicant_name: string;
  applicant_email: string;
}

export function EmployerApplicationsPage({ user, showToast }: { user: any, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchApplications();
  }, [user]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      // Querying the view or joining tables
      // We'll use a join query to be safe
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id,
          status,
          employer_notes,
          applied_at,
          jobs!inner (
            title,
            posted_by
          ),
          profiles:user_id (
            full_name,
            email
          )
        `)
        .eq("jobs.posted_by", user.id)
        .order("applied_at", { ascending: false });

      if (error) throw error;

      const formatted = data.map((app: any) => ({
        id: app.id,
        status: app.status || "pending",
        notes: app.notes || "",
        created_at: app.created_at,
        job_title: app.jobs.title,
        applicant_name: app.profiles.full_name,
        applicant_email: app.profiles.email
      }));

      setApplications(formatted);
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (applicationId: string, status: 'shortlisted' | 'rejected') => {
    const notes = prompt(`Add a note for the applicant (optional):`);
    if (notes === null) return; // Cancelled

    setProcessingId(applicationId);
    try {
      const response = await fetch("/api/applications/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, status, notes }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update status");
      }

      showToast(`Applicant ${status} successfully!`);
      fetchApplications();
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight">Manage Applications</h1>
        <p className="text-zinc-500 mt-1">Review and respond to candidates who applied for your jobs.</p>
      </div>

      {applications.length > 0 ? (
        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Applicant</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Job Position</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Applied On</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-400">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-white">{app.applicant_name}</p>
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {app.applicant_email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Briefcase className="w-4 h-4 text-emerald-500" />
                      <span className="font-medium">{app.job_title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                      app.status === 'shortlisted' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      app.status === 'rejected' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                      "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                    )}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">
                    {new Date(app.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {app.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(app.id, 'shortlisted')}
                            disabled={processingId === app.id}
                            className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all"
                            title="Shortlist"
                          >
                            {processingId === app.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(app.id, 'rejected')}
                            disabled={processingId === app.id}
                            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                            title="Reject"
                          >
                            {processingId === app.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-zinc-600 italic text-xs">
                          <MessageSquare className="w-3 h-3" />
                          Reviewed
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-20 text-center border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
          <Briefcase className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-zinc-400">No applications to review</h3>
          <p className="text-zinc-500 mt-2">When candidates apply for your jobs, they will appear here.</p>
        </div>
      )}
    </main>
  );
}
