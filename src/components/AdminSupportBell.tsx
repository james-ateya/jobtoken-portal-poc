import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { apiFetch } from "../lib/apiFetch";
import { cn } from "../lib/utils";

type AlertTicket = {
  id: string;
  ticket_number: string;
  email: string;
  name: string | null;
  subject: string;
  status: string;
  priority: string;
  updated_at: string;
  unread: boolean;
};

function formatRelative(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AdminSupportBell() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [tickets, setTickets] = useState<AlertTicket[]>([]);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/support/alerts");
      if (!res.ok) return;
      const data = await res.json();
      setOpenCount(Number(data.open_count) || 0);
      setUnreadCount(Number(data.unread_count) || 0);
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
    } catch {
      /* ignore polling errors */
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const id = window.setInterval(loadAlerts, 60_000);
    return () => window.clearInterval(id);
  }, [loadAlerts]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    loadAlerts().finally(() => setLoading(false));
  }, [open, loadAlerts]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(ticketId: string) {
    await apiFetch("/api/admin/support/alerts/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket_id: ticketId }),
    });
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    setMarking(true);
    try {
      await apiFetch("/api/admin/support/alerts/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      await loadAlerts();
    } finally {
      setMarking(false);
    }
  }

  async function openTicket(ticket: AlertTicket) {
    setOpen(false);
    if (ticket.unread) {
      try {
        await markRead(ticket.id);
        await loadAlerts();
      } catch {
        /* still navigate */
      }
    }
    navigate(`/admin/support?ticket=${encodeURIComponent(ticket.id)}`);
  }

  const badgeCount = unreadCount > 0 ? unreadCount : openCount > 0 ? openCount : 0;
  const badgeIsUnread = unreadCount > 0;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
        aria-label="Support ticket alerts"
        title="Support tickets"
      >
        <Bell className="w-5 h-5" />
        {badgeCount > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
              badgeIsUnread
                ? "bg-red-500 text-white"
                : "bg-zinc-400 text-white dark:bg-zinc-600"
            )}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white shadow-xl z-50 dark:border-white/10 dark:bg-zinc-950 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-zinc-100 dark:border-white/10">
            <div>
              <p className="text-sm font-bold text-zinc-900 dark:text-white">Support tickets</p>
              <p className="text-[11px] text-zinc-500">
                {openCount} open
                {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={marking || unreadCount === 0}
              onClick={markAllRead}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:pointer-events-none dark:text-emerald-400 dark:hover:bg-emerald-500/10"
            >
              {marking ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
              Mark all read
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto p-1.5">
            {loading && tickets.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-zinc-500 text-sm p-6 text-center">No open tickets</p>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTicket(t)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg mb-0.5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-colors",
                    t.unread
                      ? "bg-emerald-50 dark:bg-emerald-500/10"
                      : "bg-transparent hover:bg-zinc-50 dark:hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      {t.ticket_number}
                    </span>
                    <span className="text-[10px] text-zinc-400 shrink-0">
                      {formatRelative(t.updated_at)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                    {t.subject}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-[11px] text-zinc-500 truncate">{t.email}</p>
                    {t.unread ? (
                      <button
                        type="button"
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 shrink-0"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await markRead(t.id);
                          await loadAlerts();
                        }}
                      >
                        Mark read
                      </button>
                    ) : (
                      <span className="text-[10px] text-zinc-400 shrink-0">Seen</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-zinc-100 dark:border-white/10 p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/admin/support");
              }}
              className="w-full text-center text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10 rounded-lg py-2"
            >
              Open support inbox
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
