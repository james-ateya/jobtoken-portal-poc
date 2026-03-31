import { motion, AnimatePresence } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { X, Building2, MapPin, Briefcase } from "lucide-react";

/** Seeker-facing: company fields only; individual names are not shown (privacy). */
export type PublicEmployerCompany = {
  full_name?: string | null;
  company_name: string | null;
  office_location: string | null;
  area_of_business: string | null;
};

function hasText(v: string | null | undefined) {
  return !!(v && String(v).trim());
}

function FieldBlock({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: LucideIcon;
}) {
  const ok = hasText(value);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
        {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
        {label}
      </p>
      {ok ? (
        <p className="text-sm text-zinc-200 whitespace-pre-wrap">{String(value).trim()}</p>
      ) : (
        <p className="text-sm text-zinc-600 italic">Not provided</p>
      )}
    </div>
  );
}

export function CompanyProfileSeekerModal({
  open,
  onClose,
  jobTitle,
  employer,
}: {
  open: boolean;
  onClose: () => void;
  jobTitle?: string | null;
  employer: PublicEmployerCompany | null;
}) {
  const displayName =
    hasText(employer?.company_name) ? employer!.company_name!.trim() : null;
  const heading = displayName || "Company profile";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[55] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative w-full max-w-md max-h-[min(85vh,560px)] flex flex-col rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                  <Building2 className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-white leading-tight">{heading}</h2>
                  {jobTitle ? (
                    <p className="text-xs text-zinc-500 mt-2">
                      Listing: <span className="text-zinc-400">{jobTitle}</span>
                    </p>
                  ) : null}
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
              {!employer ? (
                <p className="text-sm text-zinc-500">
                  Sign in to see employer details, or this company has not added a profile yet.
                </p>
              ) : (
                <>
                  <FieldBlock
                    label="Company name"
                    value={employer.company_name}
                    icon={Building2}
                  />
                  <FieldBlock
                    label="Office location"
                    value={employer.office_location}
                    icon={MapPin}
                  />
                  <FieldBlock
                    label="Area of business"
                    value={employer.area_of_business}
                    icon={Briefcase}
                  />
                  {jobTitle ? (
                    <p className="text-xs text-zinc-600 pt-2 border-t border-white/5">
                      Individual contacts are not shown here. If you apply and the employer moves
                      your application forward, you can communicate through JobToken from there.
                    </p>
                  ) : null}
                </>
              )}
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
