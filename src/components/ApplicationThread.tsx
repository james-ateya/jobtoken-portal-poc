import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Send, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

type MessageRow = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
};

export function ApplicationThread({
  applicationId,
  currentUserId,
}: {
  applicationId: string;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, body, sender_id, created_at")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true });

    if (!error && data) setMessages(data as MessageRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`messages:${applicationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `application_id=eq.${applicationId}`,
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [applicationId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;

    setSending(true);
    const { error } = await supabase.from("messages").insert({
      application_id: applicationId,
      sender_id: currentUserId,
      body: text,
    });
    setSending(false);
    if (!error) {
      setBody("");
      load();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        In-app thread
      </p>
      <div className="max-h-40 overflow-y-auto space-y-2 text-sm">
        {messages.length === 0 ? (
          <p className="text-zinc-500 text-xs italic">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-lg px-3 py-2 max-w-[95%]",
                m.sender_id === currentUserId
                  ? "ml-auto bg-emerald-500/15 text-emerald-100 border border-emerald-500/20"
                  : "mr-auto bg-white/5 text-zinc-300 border border-white/10"
              )}
            >
              <p>{m.body}</p>
              <p className="text-[9px] text-zinc-600 mt-1">
                {new Date(m.created_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="p-2 rounded-lg bg-emerald-500 text-black disabled:opacity-40"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
