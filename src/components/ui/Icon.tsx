import type { SVGProps } from "react";

export type IconName =
  | "archive"
  | "arrow-left"
  | "calculator"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "close"
  | "competitors"
  | "document"
  | "evidence"
  | "folder"
  | "history"
  | "home"
  | "menu"
  | "objective"
  | "plus"
  | "report"
  | "save"
  | "trash"
  | "warning";

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...common} {...props}>
      {name === "archive" ? <><path d="M4 7.5h16v12H4z" /><path d="M3 4.5h18v3H3zM9 11h6" /></> : null}
      {name === "arrow-left" ? <><path d="m10 6-6 6 6 6" /><path d="M4 12h16" /></> : null}
      {name === "calculator" ? <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8v3H8zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" /></> : null}
      {name === "check" ? <path d="m5 12 4 4L19 6" /> : null}
      {name === "chevron-left" ? <path d="m15 18-6-6 6-6" /> : null}
      {name === "chevron-right" ? <path d="m9 18 6-6-6-6" /> : null}
      {name === "close" ? <><path d="m6 6 12 12M18 6 6 18" /></> : null}
      {name === "competitors" ? <><path d="M4 19v-1.5A3.5 3.5 0 0 1 7.5 14h3a3.5 3.5 0 0 1 3.5 3.5V19" /><circle cx="9" cy="8" r="3" /><path d="M15 5.5a3 3 0 0 1 0 5.5M16 14a4 4 0 0 1 4 4v1" /></> : null}
      {name === "document" ? <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></> : null}
      {name === "evidence" ? <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></> : null}
      {name === "folder" ? <path d="M3 6.5h7l2 2h9v10H3z" /> : null}
      {name === "history" ? <><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5" /><path d="M4 4v4.5h4.5M12 8v4l3 2" /></> : null}
      {name === "home" ? <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></> : null}
      {name === "menu" ? <><path d="M4 7h16M4 12h16M4 17h16" /></> : null}
      {name === "objective" ? <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 4V2M20 12h2M12 20v2M4 12H2" /></> : null}
      {name === "plus" ? <><path d="M12 5v14M5 12h14" /></> : null}
      {name === "report" ? <><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v5h5M9 13h6M9 17h4" /></> : null}
      {name === "save" ? <><path d="M5 3h12l2 2v16H5z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></> : null}
      {name === "trash" ? <><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></> : null}
      {name === "warning" ? <><path d="M12 3 2.5 20h19z" /><path d="M12 9v5M12 17h.01" /></> : null}
    </svg>
  );
}
