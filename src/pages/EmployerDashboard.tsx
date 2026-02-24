import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "motion/react";
import { Briefcase, Users, Plus, ChevronRight, Loader2, ArrowLeft, Send } from "lucide-react";
import { cn } from "../lib/utils";

interface Job {
  id: string;
  title: string;
  description: string;
  job_type: string;
  token_cost: number;
  created_at: string;
  applications_count?: number;
}

interface Applicant {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export function EmployerDashboard({ user, showToast }: { user: any, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPostForm, setShowPostForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  // Form State
  const [newJob, setNewJob] = useState({
    title: "",
    description: "",
    job_type: "",
    token_cost: 1
  });
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (user) fetchEmployerJobs();
  }, [user]);

  const fetchEmployerJobs = async () => {
    setLoading(true);
    try {
      // Fetch jobs and count applications for each
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          *,
          applications:applications(count)
        `)
        .eq("posted_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const formattedJobs = data.map(job => ({
        ...job,
        applications_count: job.applications[0]?.count || 0
      }));
      
      setJobs(formattedJobs);
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchApplicants = async (jobId: string) => {
    setLoadingApplicants(true);
    try {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          created_at,
          profiles:user_id (
            id,
            full_name,
            email
          )
        `)
        .eq("job_id", jobId);

      if (error) throw error;
      
      const formattedApplicants = data.map((item: any) => ({
        id: item.profiles.id,
        full_name: item.profiles.full_name,
        email: item.profiles.email,
        created_at: item.created_at
      }));
      
      setApplicants(formattedApplicants);
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setLoadingApplicants(false);
    }
  };

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newJob.job_type) {
      showToast("Please select a job type", "error");
      return;
    }

    setPosting(true);
    try {
      const { error } = await supabase.from("jobs").insert({
        ...newJob,
        posted_by: user.id
      });

      if (error) throw error;

      showToast("Job posted successfully!");
      setShowPostForm(false);
      setNewJob({ title: "", description: "", job_type: "", token_cost: 1 });
      fetchEmployerJobs();
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setPosting(false);
    }
  };

  const handleViewApplicants = (job: Job) => {
    setSelectedJob(job);
    fetchApplicants(job.id);
  };

  if (loading && !jobs.length) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employer Portal</h1>
          <p className="text-zinc-500 mt-1">Manage your job listings and track applicants.</p>
        </div>
        {!selectedJob && !showPostForm && (
          <div className="flex gap-4">
            <Link
              to="/dashboard/employer/applications"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white/5 text-white border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              <Users className="w-5 h-5" />
              Manage All Applications
            </Link>
            <button
              onClick={() => setShowPostForm(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              Post a New Job
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showPostForm ? (
          <motion.div
            key="post-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl mx-auto"
          >
            <div className="mb-8 flex items-center gap-4">
              <button 
                onClick={() => setShowPostForm(false)}
                className="p-2 rounded-full hover:bg-white/5 text-zinc-400 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-bold">Post a New Job</h2>
            </div>

            <form onSubmit={handlePostJob} className="space-y-6 p-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400 ml-1">Job Title</label>
                <input 
                  type="text" 
                  required
                  value={newJob.title}
                  onChange={(e) => setNewJob({...newJob, title: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="e.g. Senior React Developer"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400 ml-1">Description</label>
                <textarea 
                  required
                  rows={5}
                  value={newJob.description}
                  onChange={(e) => setNewJob({...newJob, description: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                  placeholder="Describe the role, requirements, and benefits..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400 ml-1">Job Type</label>
                  <select 
                    required
                    value={newJob.job_type}
                    onChange={(e) => setNewJob({...newJob, job_type: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
                  >
                    <option value="" disabled>Select Type</option>
                    <option value="Remote">Remote</option>
                    <option value="Onsite">Onsite</option>
                    <option value="Online">Online</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400 ml-1">Token Cost (to apply)</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={newJob.token_cost}
                    onChange={(e) => setNewJob({...newJob, token_cost: parseInt(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={posting}
                className="w-full py-4 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {posting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Publish Job Listing
              </button>
            </form>
          </motion.div>
        ) : selectedJob ? (
          <motion.div
            key="applicants-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedJob(null)}
                  className="p-2 rounded-full hover:bg-white/5 text-zinc-400 transition-colors"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                  <h2 className="text-2xl font-bold">{selectedJob.title}</h2>
                  <p className="text-zinc-500 text-sm">Applicants for this position</p>
                </div>
              </div>
              <div className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-sm">
                {applicants.length} Total
              </div>
            </div>

            {loadingApplicants ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                <span className="text-zinc-500 font-medium">Loading Applicants...</span>
              </div>
            ) : applicants.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {applicants.map((applicant) => (
                  <div key={applicant.id} className="p-6 rounded-2xl border border-white/10 bg-white/5">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4">
                      <Users className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">{applicant.full_name}</h3>
                    <p className="text-zinc-400 text-sm mb-4">{applicant.email}</p>
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      <span>Applied on</span>
                      <span>{new Date(applicant.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
                <Users className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-zinc-400">No applicants yet</h3>
                <p className="text-zinc-500 mt-2">Check back later as users discover your job post.</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="jobs-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {jobs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {jobs.map((job) => (
                  <div 
                    key={job.id} 
                    className="p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.08] transition-all group"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">{job.title}</h3>
                        <p className="text-zinc-500 text-xs mt-1">Posted on {new Date(job.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        {job.job_type}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Applicants</p>
                        <p className="text-2xl font-bold text-white">{job.applications_count}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Token Cost</p>
                        <p className="text-2xl font-bold text-white">{job.token_cost}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleViewApplicants(job)}
                      className="w-full py-3 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                    >
                      View Applicants
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
                <Briefcase className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-zinc-400">No jobs posted yet</h3>
                <p className="text-zinc-500 mt-2">Click the button above to post your first job listing.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
