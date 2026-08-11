import { useRef, type KeyboardEvent, type ReactNode } from "react";

export function StatCard({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-stone-800 bg-stone-950/45 px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">{label}</p>
      <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums tracking-tight text-stone-50">{value}</p>
      {detail ? <p className="mt-1 text-xs text-stone-500">{detail}</p> : null}
    </div>
  );
}

export function TableContainer({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-[var(--radius-lg)] border border-stone-800 bg-stone-950/35">
      {children}
    </div>
  );
}

export function Tabs({ active, id = "workspace-tabs", onChange, tabs }: { active: string; id?: string; onChange: (value: string) => void; tabs: Array<{ label: string; value: string }> }) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    onChange(tabs[nextIndex].value);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div aria-label="Workspace files" className="inline-flex rounded-[var(--radius-md)] border border-stone-800 bg-stone-950/60 p-1" role="tablist">
      {tabs.map((tab) => (
        <button
          aria-controls={`${id}-panel-${tab.value}`}
          aria-selected={active === tab.value}
          className={`min-h-9 rounded-md px-3 text-sm font-semibold outline-none transition-colors duration-[var(--motion-fast)] focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${active === tab.value ? "bg-stone-800 text-stone-50" : "text-stone-500 hover:text-stone-200"}`}
          id={`${id}-tab-${tab.value}`}
          key={tab.value}
          onClick={() => onChange(tab.value)}
          onKeyDown={(event) => onKeyDown(event, tabs.indexOf(tab))}
          ref={(element) => { tabRefs.current[tabs.indexOf(tab)] = element; }}
          role="tab"
          tabIndex={active === tab.value ? 0 : -1}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
