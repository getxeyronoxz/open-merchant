import { Icon, IconButton, type IconName } from "./ui";

export const workspaceSections = ["Objective", "Evidence", "Competitors", "Economics", "Report", "Artifacts"] as const;
export type WorkspaceSection = (typeof workspaceSections)[number];

const sectionIcons: Record<WorkspaceSection, IconName> = {
  Objective: "objective",
  Evidence: "evidence",
  Competitors: "competitors",
  Economics: "calculator",
  Report: "report",
  Artifacts: "archive",
};

export function WorkspaceNavigation({
  activeSection,
  collapsed,
  onCollapsedChange,
  onSelect,
}: {
  activeSection: WorkspaceSection;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onSelect: (section: WorkspaceSection) => void;
}) {
  return (
    <aside className="sticky top-[81px] self-start rounded-[var(--radius-xl)] border border-stone-800/90 bg-[var(--surface-rail)] p-2 shadow-[var(--shadow-panel)]">
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-end"}`}>
        <IconButton
          aria-expanded={!collapsed}
          icon={collapsed ? "chevron-right" : "chevron-left"}
          label={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={() => onCollapsedChange(!collapsed)}
        />
      </div>
      <nav aria-label="Workspace sections" className="mt-2 grid gap-1">
        {workspaceSections.map((item) => {
          const selected = activeSection === item;
          return (
            <button
              aria-current={selected ? "page" : undefined}
              aria-label={item}
              className={`group flex min-h-11 w-full items-center rounded-[var(--radius-md)] text-sm font-medium outline-none transition-[background-color,color] duration-[var(--motion-fast)] focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${collapsed ? "justify-center px-2" : "gap-3 px-3 text-left"} ${selected ? "bg-emerald-300 text-stone-950" : "text-stone-400 hover:bg-stone-800/80 hover:text-stone-100"}`}
              key={item}
              onClick={() => onSelect(item)}
              title={collapsed ? item : undefined}
              type="button"
            >
              <Icon className="size-[18px] shrink-0" name={sectionIcons[item]} />
              <span className={collapsed ? "sr-only" : "truncate"}>{item}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
