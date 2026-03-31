import { motion, AnimatePresence } from "motion/react";
import { X, User, Mail, Briefcase, Linkedin, Calendar } from "lucide-react";
import { areasFocusMatch } from "../lib/businessAreas";

export type SeekerProfileForEmployer = {
  fullName: string | null;
  email: string | null;
  phone?: string | null;
  location?: string | null;
  professionOrStudy?: string | null;
  education?: string | null;
  experience?: string | null;
  skills?: string | null;
  linkedinUrl?: string | null;
  jobTitle?: string | null;
  jobAreaOfBusiness?: string | null;
  appliedAt?: string | null;
};

function hasText(v: string | null | undefined) {
  return !!(v && String(v).trim());
}

function FieldBlock({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
}) {
  const ok = hasText(value);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{label}</p>
      {ok ? (
        <p
          className={`text-sm text-zinc-200 ${multiline ? "whitespace-pre-wrap leading-relaxed" : ""}`}
        >
          {String(value).trim()}
        </p>
      ) : (
        <p className="text-sm text-zinc-600 italic">Not provided</p>
      )}
    </div>
  );
}

export function SeekerFullProfileModal({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: SeekerProfileForEmployer | null;
}) {
  const focusMatch = areasFocusMatch(
    profile?.professionOrStudy,
    profile?.jobAreaOfBusiness
  );

  return (
    <AnimatePresence>
      {open && profile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative w-full max-w-2xl max-h-[min(90vh,720px)] flex flex-col rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                  <User className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-white leading-tight">
                    {hasText(profile.fullName) ? profile.fullName : "Applicant"}
                  </h2>
                  {hasText(profile.email) ? (
                    <a
                      href={`mailto:${profile.email}`}
                      className="text-sm text-emerald-400/90 hover:text-emerald-300 flex items-center gap-2 mt-2 break-all"
                    >
                      <Mail className="w-4 h-4 shrink-0" />
                      {profile.email}
                    </a>
                  ) : (
                    <p className="text-sm text-zinc-600 italic mt-2">No email on profile</p>
                  )}
                  {(profile.jobTitle || profile.appliedAt) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-zinc-500">
                      {profile.jobTitle ? (
                        <span className="inline-flex items-center gap-1.5 text-zinc-400">
                          <Briefcase className="w-3.5 h-3.5 text-emerald-500/80" />
                          Applied for: <span className="text-zinc-300">{profile.jobTitle}</span>
                        </span>
                      ) : null}
                      {profile.appliedAt ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(profile.appliedAt).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {focusMatch ? (
                <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  <strong className="text-emerald-300">Role focus match:</strong> profession or area
                  of study aligns with this job&apos;s role focus.
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldBlock label="Phone" value={profile.phone} />
                <FieldBlock label="Location" value={profile.location} />
              </div>

              <FieldBlock
                label="Profession or area of study"
                value={profile.professionOrStudy}
              />

              <FieldBlock label="Education" value={profile.education} multiline />
              <FieldBlock label="Work experience" value={profile.experience} multiline />
              <FieldBlock label="Skills" value={profile.skills} multiline />

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
                  <Linkedin className="w-3.5 h-3.5" />
                  LinkedIn
                </p>
                {hasText(profile.linkedinUrl) ? (
                  <a
                    href={profile.linkedinUrl!.startsWith("http") ? profile.linkedinUrl! : `https://${profile.linkedinUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-400 hover:text-emerald-300 break-all"
                  >
                    {profile.linkedinUrl}
                  </a>
                ) : (
                  <p className="text-sm text-zinc-600 italic">Not provided</p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/10 bg-black/20 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl border border-white/15 text-zinc-200 font-medium hover:bg-white/5 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Map application row (employer applications page) to modal profile shape. */
export function seekerProfileFromApplication(app: {
  applicant_name: string;
  applicant_email: string;
  applicant_phone?: string | null;
  applicant_location?: string | null;
  applicant_education?: string | null;
  applicant_experience?: string | null;
  applicant_skills?: string | null;
  applicant_linkedin?: string | null;
  applicant_profession_or_study?: string | null;
  job_title: string;
  job_area_of_business?: string | null;
  created_at: string;
}): SeekerProfileForEmployer {
  return {
    fullName: app.applicant_name,
    email: app.applicant_email,
    phone: app.applicant_phone,
    location: app.applicant_location,
    professionOrStudy: app.applicant_profession_or_study,
    education: app.applicant_education,
    experience: app.applicant_experience,
    skills: app.applicant_skills,
    linkedinUrl: app.applicant_linkedin,
    jobTitle: app.job_title,
    jobAreaOfBusiness: app.job_area_of_business ?? null,
    appliedAt: app.created_at,
  };
}

/** Map dashboard applicant + job to modal profile shape. */
export function seekerProfileFromApplicantCard(
  applicant: {
    full_name: string;
    email: string;
    phone?: string | null;
    location?: string | null;
    education?: string | null;
    experience?: string | null;
    skills?: string | null;
    linkedin_url?: string | null;
    profession_or_study?: string | null;
    created_at: string;
  },
  job: { title: string; area_of_business?: string | null }
): SeekerProfileForEmployer {
  return {
    fullName: applicant.full_name,
    email: applicant.email,
    phone: applicant.phone,
    location: applicant.location,
    professionOrStudy: applicant.profession_or_study,
    education: applicant.education,
    experience: applicant.experience,
    skills: applicant.skills,
    linkedinUrl: applicant.linkedin_url,
    jobTitle: job.title,
    jobAreaOfBusiness: job.area_of_business ?? null,
    appliedAt: applicant.created_at,
  };
}
