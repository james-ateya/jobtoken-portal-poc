import { useState, useEffect, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion } from "motion/react";
import {
  User,
  Phone,
  MapPin,
  GraduationCap,
  Briefcase,
  Wrench,
  Linkedin,
  Loader2,
  ArrowLeft,
  Save,
  BookOpen,
} from "lucide-react";
import { BUSINESS_AREAS } from "../lib/businessAreas";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  education: string | null;
  experience: string | null;
  skills: string | null;
  linkedin_url: string | null;
  profession_or_study: string | null;
};

export function SeekerProfilePage({
  user,
  showToast,
}: {
  user: any;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    location: "",
    education: "",
    experience: "",
    skills: "",
    linkedin_url: "",
    profession_or_study: "",
  });

  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone, location, education, experience, skills, linkedin_url, profession_or_study"
        )
        .eq("id", user.id)
        .single();

      if (error) {
        console.error(error);
        showToast("Could not load your profile.", "error");
        setLoading(false);
        return;
      }

      const p = data as ProfileRow;
      setForm({
        full_name: p.full_name || "",
        phone: p.phone || "",
        location: p.location || "",
        education: p.education || "",
        experience: p.experience || "",
        skills: p.skills || "",
        linkedin_url: p.linkedin_url || "",
        profession_or_study: p.profession_or_study || "",
      });
      setLoading(false);
    };

    load();
  }, [user?.id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim() || null,
          phone: form.phone.trim() || null,
          location: form.location.trim() || null,
          education: form.education.trim() || null,
          experience: form.experience.trim() || null,
          skills: form.skills.trim() || null,
          linkedin_url: form.linkedin_url.trim() || null,
          profession_or_study: form.profession_or_study.trim() || null,
        })
        .eq("id", user.id);

      if (error) throw error;
      showToast("Profile saved. Employers see this when you apply.");
    } catch (err: any) {
      showToast(err.message || "Failed to save profile", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-emerald-400 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Your profile</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Information employers see alongside your applications. Your profession or area of
              study is used to alert you when new jobs match your field.
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-500 mt-4 mb-8 p-3 rounded-xl bg-white/5 border border-white/5">
          <strong className="text-zinc-400">Tip:</strong> Use the education field for degrees and
          institutions, experience for roles and years, and skills as a comma-separated list (e.g.{" "}
          <span className="text-zinc-400">React, TypeScript, Customer service</span>).
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1 flex items-center gap-2">
              <User className="w-4 h-4" />
              Full name
            </label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Name as it should appear to employers"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Profession or area of study
            </label>
            <select
              value={form.profession_or_study}
              onChange={(e) => setForm((f) => ({ ...f, profession_or_study: e.target.value }))}
              className="select-themed"
            >
              <option value="">Select your field (optional)</option>
              {BUSINESS_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500">
              Same categories as employer <span className="text-zinc-400">area of business</span>{" "}
              and job <span className="text-zinc-400">role focus</span>. When they match, you can get
              email and in-app alerts for new listings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400 ml-1 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="+254… or 07…"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400 ml-1 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Location
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="City, country"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Education
            </label>
            <textarea
              rows={4}
              value={form.education}
              onChange={(e) => setForm((f) => ({ ...f, education: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              placeholder="e.g. BSc Computer Science — University of Nairobi, 2022"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1 flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Work experience
            </label>
            <textarea
              rows={5}
              value={form.experience}
              onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              placeholder="Roles, companies, and years — short summary is fine"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1 flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Skills
            </label>
            <textarea
              rows={3}
              value={form.skills}
              onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              placeholder="Comma-separated or one per line"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1 flex items-center gap-2">
              <Linkedin className="w-4 h-4" />
              LinkedIn (optional)
            </label>
            <input
              type="url"
              value={form.linkedin_url}
              onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="https://linkedin.com/in/…"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save profile
          </button>
        </form>
      </motion.div>
    </main>
  );
}
