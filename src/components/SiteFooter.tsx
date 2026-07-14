import { Link } from "react-router-dom";
import { Briefcase } from "lucide-react";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-300/70 bg-zinc-100 dark:border-white/5 dark:bg-black/40">
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-500">
          <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center text-black">
            <Briefcase className="w-4 h-4" />
          </div>
          <span>
            © {year} JobToken Portal ·{" "}
            <a
              href="https://www.jobtoken.co.ke"
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              jobtoken.co.ke
            </a>
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium">
          <Link
            to="/privacy"
            className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors"
          >
            Privacy
          </Link>
          <Link
            to="/terms"
            className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors"
          >
            Terms of Use
          </Link>
          <Link
            to="/contact"
            className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors"
          >
            Contact Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}
