import { useState, useRef, useEffect } from "react";
import { Monitor, Moon, Sun, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import { useTheme, type ThemeMode } from "../theme/ThemeProvider";

const options: { id: ThemeMode; label: string; Icon: typeof Moon }[] = [
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "light", label: "Light", Icon: Sun },
  { id: "system", label: "System", Icon: Monitor },
];

export function ThemeMenu() {
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const active = options.find((o) => o.id === mode) ?? options[0];
  const ActiveIcon = active.Icon;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors border",
          "border-zinc-300 bg-white/80 text-zinc-800 hover:bg-white",
          "dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Theme"
      >
        <ActiveIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <span className="hidden sm:inline">{active.label}</span>
        <ChevronDown className={cn("w-4 h-4 opacity-60 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          className={cn(
            "absolute right-0 top-full mt-2 py-1 min-w-[10rem] rounded-xl border shadow-xl z-50",
            "border-zinc-200 bg-white text-zinc-900",
            "dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100"
          )}
          role="listbox"
        >
          {options.map(({ id, label, Icon }) => (
            <li key={id} role="option" aria-selected={mode === id}>
              <button
                type="button"
                onClick={() => {
                  setMode(id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-zinc-100",
                  "dark:hover:bg-white/10",
                  mode === id && "text-emerald-600 dark:text-emerald-400 font-semibold"
                )}
              >
                <Icon className="w-4 h-4 shrink-0 opacity-80" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
