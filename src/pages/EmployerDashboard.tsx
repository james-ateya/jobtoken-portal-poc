import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "motion/react";
import {
  Briefcase,
  Users,
  Plus,
  ChevronRight,
  Loader2,
  ArrowLeft,
  Send,
  Bell,
  Star,
  Pencil,
  CalendarClock,
} from "lucide-react";
import { ApplicationThread } from "../components/ApplicationThread";
import {
  SeekerFullProfileModal,
  seekerProfileFromApplicantCard,
} from "../components/SeekerFullProfileModal";
import { cn } from "../lib/utils";
import { BUSINESS_AREAS, areasFocusMatch } from "../lib/businessAreas";
import { WalletDashboard } from "../components/WalletDashboard";

interface Job {
  id: string;
  title: string;
  description: string;
  job_type: string;
  token_cost: number;
  created_at: string;
  applications_count?: number;
  is_featured?: boolean;
  closes_at?: string | null;
  area_of_business?: string | null;
}

function jobListingExpired(job: Job) {
  return !!(job.closes_at && new Date(job.closes_at) <= new Date());
}

interface Applicant {
  application_id: string;
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  phone?: string | null;
  location?: string | null;
  education?: string | null;
  experience?: string | null;
  skills?: string | null;
  linkedin_url?: string | null;
  profession_or_study?: string | null;
}

export function EmployerDashboard({ user, showToast }: { user: any, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobFormOpen, setJobFormOpen] = useState(false);
  const [jobFormMode, setJobFormMode] = useState<"create" | "edit">("create");
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  const [jobForm, setJobForm] = useState({
    title: "",
    description: "",
    job_type: "",
    token_cost: 1,
    is_featured: false,
    closes_at: "",
    area_of_business: "",
  });
  const [posting, setPosting] = useState(false);
  const [employerTokens, setEmployerTokens] = useState<number | null>(null);
  const [employerExpiresAt, setEmployerExpiresAt] = useState<string | null>(null);
  const [featureJobTokens, setFeatureJobTokens] = useState<number>(2);
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [fullProfileApplicant, setFullProfileApplicant] = useState<Applicant | null>(null);

  useEffect(() => {
    if (user) {
      fetchEmployerJobs();
      fetchEmployerWallet();
      fetchNotifications();
    }
  }, [user]);

  useEffect(() => {
    fetch("/api/employer/pricing")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.featureJobTokens === "number") setFeatureJobTokens(d.featureJobTokens);
      })
      .catch(() => {})
      .finally(() => setPricingLoaded(true));
  }, []);

  const fetchEmployerWallet = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("wallets")
      .select("token_balance, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    setEmployerTokens(data?.token_balance ?? 0);
    setEmployerExpiresAt(data?.expires_at ?? null);
  };

  const fetchNotifications = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      console.warn("notifications:", error.message);
      return;
    }
    if (data) setNotifications(data);
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markNotificationRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    fetchNotifications();
  };

  const fetchEmployerJobs = async () => {
    setLoading(true);
    try {
      // Fetch jobs and count applications for each
      const { data, error } = await supabase
        .from("jobs")
        .select(
          `
          id,
          title,
          description,
          job_type,
          token_cost,
          posted_by,
          is_featured,
          closes_at,
          area_of_business,
          created_at,
          applications:applications(count)
        `
        )
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
          id,
          created_at,
          profiles:user_id (
            id,
            full_name,
            email,
            phone,
            location,
            education,
            experience,
            skills,
            linkedin_url,
            profession_or_study
          )
        `)
        .eq("job_id", jobId);

      if (error) throw error;

      const formattedApplicants = data.map((item: any) => ({
        application_id: item.id,
        id: item.profiles.id,
        full_name: item.profiles.full_name,
        email: item.profiles.email,
        created_at: item.created_at,
        phone: item.profiles.phone,
        location: item.profiles.location,
        education: item.profiles.education,
        experience: item.profiles.experience,
        skills: item.profiles.skills,
        linkedin_url: item.profiles.linkedin_url,
        profession_or_study: item.profiles.profession_or_study,
      }));
      
      setApplicants(formattedApplicants);
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setLoadingApplicants(false);
    }
  };

  const closeJobForm = () => {
    setJobFormOpen(false);
    setEditingJobId(null);
    setJobFormMode("create");
  };

  const openCreateJobForm = () => {
    setJobFormMode("create");
    setEditingJobId(null);
    setJobForm({
      title: "",
      description: "",
      job_type: "",
      token_cost: 1,
      is_featured: false,
      closes_at: "",
      area_of_business: "",
    });
    setJobFormOpen(true);
  };

  const openEditJobForm = (job: Job) => {
    setJobFormMode("edit");
    setEditingJobId(job.id);
    const ca = job.closes_at
      ? new Date(job.closes_at).toISOString().slice(0, 16)
      : "";
    setJobForm({
      title: job.title,
      description: job.description,
      job_type: job.job_type,
      token_cost: job.token_cost,
      is_featured: !!job.is_featured,
      closes_at: ca,
      area_of_business: job.area_of_business || "",
    });
    setJobFormOpen(true);
  };

  const handleJobFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!jobForm.job_type) {
      showToast("Please select a job type", "error");
      return;
    }

    if (!jobForm.area_of_business?.trim()) {
      showToast(
        "Select the profession or field sought for this role (e.g. Finance). It can differ from your company sector in Company profile.",
        "error"
      );
      return;
    }

    setPosting(true);
    try {
      if (jobFormMode === "create") {
        const response = await fetch("/api/employer/post-job", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            title: jobForm.title,
            description: jobForm.description,
            job_type: jobForm.job_type,
            token_cost: jobForm.token_cost,
            is_featured: jobForm.is_featured,
            closes_at: jobForm.closes_at || null,
            area_of_business: jobForm.area_of_business.trim(),
            profession_sought: jobForm.area_of_business.trim(),
          }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to post job");

        showToast("Job posted successfully!");
        fetchEmployerWallet();
      } else if (editingJobId) {
        const response = await fetch("/api/employer/update-job", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            jobId: editingJobId,
            title: jobForm.title,
            description: jobForm.description,
            job_type: jobForm.job_type,
            token_cost: jobForm.token_cost,
            is_featured: jobForm.is_featured,
            closes_at: jobForm.closes_at || null,
            area_of_business: jobForm.area_of_business.trim(),
            profession_sought: jobForm.area_of_business.trim(),
          }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to update job");

        showToast("Job updated successfully!");
      }

      closeJobForm();
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
        {!selectedJob && !jobFormOpen && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((o) => !o);
                  fetchNotifications();
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 text-white border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="text-xs bg-emerald-500 text-black px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950 shadow-xl z-50 p-2">
                  {notifications.length === 0 ? (
                    <p className="text-zinc-500 text-sm p-4 text-center">No notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => markNotificationRead(n.id)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg mb-1 border border-transparent hover:border-white/10",
                          !n.read_at ? "bg-emerald-500/10" : "bg-white/5"
                        )}
                      >
                        <p className="text-xs font-bold text-emerald-400">
                          {n.type === "new_application"
                            ? "New application"
                            : String(n.type).replace(/_/g, " ")}
                        </p>
                        <p className="text-sm text-zinc-200 mt-1">
                          {(n.payload as any)?.seeker_name || "Applicant"} —{" "}
                          {(n.payload as any)?.job_title || "Job"}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <Link
              to="/dashboard/employer/profile"
              className="flex items-center justify-center gap-2 px-5 py-3 bg-white/5 text-white border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all active:scale-[0.98] text-sm"
            >
              Company profile
            </Link>
            <Link
              to="/dashboard/employer/applications"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white/5 text-white border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              <Users className="w-5 h-5" />
              Manage All Applications
            </Link>
            <button
              type="button"
              onClick={() => openCreateJobForm()}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              Post a New Job
            </button>
          </div>
        )}
      </div>

      <div
        className={cn(
          !selectedJob && "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
        )}
      >
        {!selectedJob && user?.id ? (
          <div className="lg:col-span-4 order-2 lg:order-none">
            <WalletDashboard
              balance={employerTokens ?? 0}
              onBalanceRefresh={fetchEmployerWallet}
              userId={user.id}
              expiresAt={employerExpiresAt}
              audience="employer"
            />
          </div>
        ) : null}
        <div className={cn(!selectedJob && "lg:col-span-8", selectedJob && "w-full")}>
      <AnimatePresence mode="wait">
        {jobFormOpen ? (
          <motion.div
            key="post-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl mx-auto"
          >
            <div className="mb-8 flex items-center gap-4">
              <button
                type="button"
                onClick={() => closeJobForm()}
                className="p-2 rounded-full hover:bg-white/5 text-zinc-400 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-bold">
                {jobFormMode === "create" ? "Post a New Job" : "Edit job listing"}
              </h2>
            </div>

            <form
              onSubmit={handleJobFormSubmit}
              className="space-y-6 p-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400 ml-1">Job Title</label>
                <input
                  type="text"
                  required
                  value={jobForm.title}
                  onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="e.g. Senior React Developer"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400 ml-1">Description</label>
                <textarea
                  required
                  rows={5}
                  value={jobForm.description}
                  onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                  placeholder="Describe the role, requirements, and benefits..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400 ml-1 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-zinc-500" />
                  Profession or field sought for this role
                </label>
                <select
                  required
                  value={jobForm.area_of_business}
                  onChange={(e) => setJobForm({ ...jobForm, area_of_business: e.target.value })}
                  className="select-themed"
                >
                  <option value="" disabled>
                    Select profession (e.g. Finance, even if your company is in IT)
                  </option>
                  {BUSINESS_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500">
                  This is the <strong className="text-zinc-400">role&apos;s</strong> field, not your
                  company sector (set that under{" "}
                  <Link
                    to="/dashboard/employer/profile"
                    className="text-emerald-500/90 hover:text-emerald-400"
                  >
                    Company profile
                  </Link>
                  ). Seekers with the same profession on their profile get alerts; they can filter jobs
                  by this value.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400 ml-1">Job Type</label>
                  <select
                    required
                    value={jobForm.job_type}
                    onChange={(e) => setJobForm({ ...jobForm, job_type: e.target.value })}
                    className="select-themed"
                  >
                    <option value="" disabled>
                      Select Type
                    </option>
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
                    value={jobForm.token_cost}
                    onChange={(e) =>
                      setJobForm({ ...jobForm, token_cost: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400 ml-1 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-zinc-500" />
                  Listing closes (optional)
                </label>
                <input
                  type="datetime-local"
                  value={jobForm.closes_at}
                  onChange={(e) => setJobForm({ ...jobForm, closes_at: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <p className="text-xs text-zinc-500">
                  After this time the job is hidden from the public board and seekers can no longer
                  apply. Leave empty for no automatic closing.
                </p>
              </div>

              <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.03] cursor-pointer">
                <input
                  type="checkbox"
                  checked={jobForm.is_featured}
                  onChange={(e) => setJobForm({ ...jobForm, is_featured: e.target.checked })}
                  className="mt-1 rounded border-white/20"
                />
                <div>
                  <span className="flex items-center gap-2 text-sm font-medium text-white">
                    <Star className="w-4 h-4 text-amber-400" />
                    Featured listing
                  </span>
                  <p className="text-xs text-zinc-500 mt-1">
                    Higher visibility on the job board. When you turn this on for a new job or upgrade
                    an existing listing, we deduct{" "}
                    <span className="text-zinc-300 font-medium">
                      {pricingLoaded ? featureJobTokens : "…"}
                    </span>{" "}
                    token{featureJobTokens === 1 ? "" : "s"} from your employer wallet (if that cost
                    is greater than zero). Already-featured jobs are not charged again on save.
                  </p>
                </div>
              </label>

              <button
                type="submit"
                disabled={posting}
                className="w-full py-4 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {posting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {jobFormMode === "create" ? "Publish Job Listing" : "Save changes"}
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
                  type="button"
                  onClick={() => {
                    setFullProfileApplicant(null);
                    setSelectedJob(null);
                  }}
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
                  <div key={applicant.application_id} className="p-6 rounded-2xl border border-white/10 bg-white/5">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white">{applicant.full_name}</h3>
                      {selectedJob &&
                      areasFocusMatch(
                        applicant.profession_or_study,
                        selectedJob.area_of_business
                      ) ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
                          Focus match
                        </span>
                      ) : null}
                    </div>
                    <p className="text-zinc-400 text-sm mb-2">{applicant.email}</p>
                    {applicant.profession_or_study ? (
                      <p className="text-[11px] text-zinc-500 mb-2">
                        Field:{" "}
                        <span className="text-zinc-300">{applicant.profession_or_study}</span>
                      </p>
                    ) : null}
                    {(applicant.phone || applicant.location) && (
                      <p className="text-xs text-zinc-500 mb-2">
                        {[applicant.phone, applicant.location].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {applicant.education && (
                      <p className="text-xs text-zinc-400 line-clamp-3 mb-2 whitespace-pre-wrap">
                        {applicant.education}
                      </p>
                    )}
                    {applicant.skills && (
                      <p className="text-[11px] text-emerald-500/90 mb-3 line-clamp-2">{applicant.skills}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setFullProfileApplicant(applicant)}
                      className="w-full mb-3 py-2.5 rounded-xl border border-emerald-500/35 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      View full profile
                    </button>
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                      <span>Applied on</span>
                      <span>{new Date(applicant.created_at).toLocaleDateString()}</span>
                    </div>
                    <ApplicationThread
                      applicationId={applicant.application_id}
                      currentUserId={user.id}
                    />
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

            <SeekerFullProfileModal
              open={!!fullProfileApplicant && !!selectedJob}
              onClose={() => setFullProfileApplicant(null)}
              profile={
                fullProfileApplicant && selectedJob
                  ? seekerProfileFromApplicantCard(fullProfileApplicant, selectedJob)
                  : null
              }
            />
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
                    <div className="flex justify-between items-start mb-6 gap-3">
                      <div className="min-w-0">
                        <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                          {job.title}
                        </h3>
                        <p className="text-zinc-500 text-xs mt-1">
                          Posted on {new Date(job.created_at).toLocaleDateString()}
                          {job.closes_at ? (
                            <>
                              {" "}
                              · Closes {new Date(job.closes_at).toLocaleString()}
                            </>
                          ) : null}
                        </p>
                        {jobListingExpired(job) ? (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mt-2">
                            Listing expired — not visible to seekers
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex flex-col items-end gap-1">
                          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                            {job.job_type}
                          </div>
                          {job.area_of_business ? (
                            <span
                              className="text-[9px] font-medium text-emerald-400/90 max-w-[10rem] text-right leading-tight"
                              title="Profession sought for this role"
                            >
                              {job.area_of_business}
                            </span>
                          ) : (
                            <span className="text-[9px] text-amber-400/90 max-w-[9rem] text-right leading-tight">
                              Add profession
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditJobForm(job)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:bg-white/10"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
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
        </div>
      </div>
    </main>
  );
}
