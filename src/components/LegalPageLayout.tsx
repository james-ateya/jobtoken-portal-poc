import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, FileText, Shield } from "lucide-react";

export function LegalPageLayout({
  title,
  lastUpdated,
  icon,
  children,
}: {
  title: string;
  lastUpdated?: string;
  icon: "terms" | "privacy";
  children: ReactNode;
}) {
  const Icon = icon === "privacy" ? Shield : FileText;

  return (
    <main className="max-w-3xl mx-auto px-6 py-12 pb-20">
      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-emerald-400 transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 shrink-0 bg-emerald-500/15 rounded-2xl flex items-center justify-center text-emerald-400">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
              {lastUpdated && (
                <p className="text-sm text-zinc-500 mt-2">Last updated: {lastUpdated}</p>
              )}
            </div>
          </div>
        </div>

        <div className="prose-legal space-y-8 text-zinc-300 text-[15px] leading-relaxed">
          {children}
        </div>

        <footer className="pt-8 border-t border-white/10 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link to="/privacy" className="hover:text-emerald-400 transition-colors">
            Privacy
          </Link>
          <span className="text-zinc-700">·</span>
          <Link to="/terms" className="hover:text-emerald-400 transition-colors">
            Terms of Use
          </Link>
        </footer>
      </motion.article>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-2 text-zinc-400">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
