import { useState, useEffect, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion } from "motion/react";
import { Building2, MapPin, Loader2, ArrowLeft, Save, Briefcase } from "lucide-react";
import { BUSINESS_AREAS } from "../lib/businessAreas";

type ProfileRow = {
  id: string;
  company_name: string | null;
  office_location: string | null;
  area_of_business: string | null;
};

export function EmployerProfilePage({
  user,
  showToast,
}: {
  user: any;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    office_location: "",
    area_of_business: "",
  });

  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, company_name, office_location, area_of_business")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error(error);
        showToast("Could not load your company profile.", "error");
        setLoading(false);
        return;
      }

      const p = data as ProfileRow;
      setForm({
        company_name: p.company_name || "",
        office_location: p.office_location || "",
        area_of_business: p.area_of_business || "",
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
          company_name: form.company_name.trim() || null,
          office_location: form.office_location.trim() || null,
          area_of_business: form.area_of_business.trim() || null,
        })
        .eq("id", user.id);

      if (error) throw error;
      showToast("Company profile saved.");
    } catch (err: any) {
      showToast(err.message || "Failed to save", "error");
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
        to="/dashboard/employer"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-emerald-400 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to employer dashboard
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Company profile</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              This is your <strong className="text-zinc-400">company</strong> sector. Each job you
              post has its own <strong className="text-zinc-400">profession sought</strong> (e.g. you
              can be in IT and hire for Finance).
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-500 mt-4 mb-8 p-3 rounded-xl bg-white/5 border border-white/5">
          When you post a job, choose the same <strong className="text-zinc-400">role focus</strong>{" "}
          (area of business) to notify seekers whose profession or area of study matches.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Company name
            </label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Registered or trading name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Office location
            </label>
            <input
              type="text"
              value={form.office_location}
              onChange={(e) => setForm((f) => ({ ...f, office_location: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="City, country, or &quot;Remote&quot;"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1 flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Area of business
            </label>
            <select
              value={form.area_of_business}
              onChange={(e) => setForm((f) => ({ ...f, area_of_business: e.target.value }))}
              className="select-themed"
            >
              <option value="">Select sector (optional)</option>
              {BUSINESS_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500">
              Aligns with the <span className="text-zinc-400">Profession or area of study</span>{" "}
              field on seeker profiles for matching.
            </p>
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
            Save company profile
          </button>
        </form>
      </motion.div>
    </main>
  );
}
