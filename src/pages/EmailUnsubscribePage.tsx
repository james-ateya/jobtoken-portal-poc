import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, Loader2, MailX } from "lucide-react";

export function EmailUnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token.trim()) {
        setStatus("error");
        setMessage("This unsubscribe link is missing a token.");
        return;
      }
      try {
        const res = await fetch("/api/email/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Unable to unsubscribe");
        if (!cancelled) {
          setStatus("ok");
          setMessage(data.message || "You have been unsubscribed.");
        }
      } catch (e: any) {
        if (!cancelled) {
          setStatus("error");
          setMessage(e.message || "Unable to unsubscribe");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="max-w-lg mx-auto px-6 py-20">
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center">
        {status === "loading" ? (
          <>
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto mb-4" />
            <p className="text-zinc-400">Updating your email preferences…</p>
          </>
        ) : status === "ok" ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Unsubscribed</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">{message}</p>
            <p className="text-zinc-500 text-xs mt-3">
              You will still receive important account emails (grades, payments, security).
            </p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <MailX className="w-7 h-7 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Couldn’t unsubscribe</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">{message}</p>
          </>
        )}
        <Link
          to="/"
          className="inline-flex mt-8 px-5 py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400"
        >
          Back to homepage
        </Link>
      </div>
    </main>
  );
}
