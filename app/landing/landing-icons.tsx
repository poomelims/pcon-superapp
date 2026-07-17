export type LandingIconName =
  | "alert"
  | "boq"
  | "calendar"
  | "checklist"
  | "contractor"
  | "daily"
  | "folder"
  | "history"
  | "mobile"
  | "office"
  | "progress"
  | "refresh"
  | "renovation"
  | "shield"
  | "supervisor"
  | "transfer"
  | "workers";

export function LandingIcon({ name, className = "" }: { name: LandingIconName; className?: string }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true
  };

  if (name === "workers" || name === "supervisor") {
    return <svg {...props}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.3" /><path d="M3.5 20c.8-3.4 3-5 5.5-5s4.8 1.6 5.6 5" /><path d="M14.2 15.5c2.8.2 4.8 1.7 5.5 4.5" />{name === "supervisor" ? <path d="M5.8 5.6h6.4M7 5.6c.2-2 3.8-2 4 0" /> : null}</svg>;
  }
  if (name === "folder") {
    return <svg {...props}><path d="M3.5 7.5h6l1.8 2H20.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19Z" /><path d="M7 14h10" /></svg>;
  }
  if (name === "boq") {
    return <svg {...props}><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /><path d="M9 2v4M15 2v4" /></svg>;
  }
  if (name === "daily" || name === "checklist") {
    return <svg {...props}><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M8.5 8.5 10 10l3-3" /><path d="M8.5 14h7M8.5 17h5" /></svg>;
  }
  if (name === "progress") {
    return <svg {...props}><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="m3 7 5-4 5 3 7-5" /></svg>;
  }
  if (name === "alert") {
    return <svg {...props}><path d="M12 3 2.8 20h18.4Z" /><path d="M12 9v5M12 17.2v.1" /></svg>;
  }
  if (name === "calendar") {
    return <svg {...props}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 9.5h16" /><path d="M8 13h3M8 16h6" /></svg>;
  }
  if (name === "mobile") {
    return <svg {...props}><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M10 5h4M11 19h2" /></svg>;
  }
  if (name === "refresh") {
    return <svg {...props}><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 8A7 7 0 0 1 18 6l2 6M18 16a7 7 0 0 1-11.9 2L4 12" /></svg>;
  }
  if (name === "transfer") {
    return <svg {...props}><path d="M5 7h12l-3-3M19 17H7l3 3" /><path d="m17 7 3-3M7 17l-3 3" /></svg>;
  }
  if (name === "contractor") {
    return <svg {...props}><path d="M5 10h14M7 10V8a5 5 0 0 1 10 0v2M10 4v4M14 4v4" /><path d="M6 14c1.2-1.2 3.2-2 6-2s4.8.8 6 2v6H6Z" /></svg>;
  }
  if (name === "renovation") {
    return <svg {...props}><path d="m3 11 9-7 9 7" /><path d="M5.5 10v10h13V10M9 20v-6h6v6" /><path d="m17 5 2 2" /></svg>;
  }
  if (name === "office") {
    return <svg {...props}><path d="M4 21V5h10v16M14 10h6v11" /><path d="M7 9h4M7 13h4M7 17h4M16.5 14h1M16.5 17h1" /></svg>;
  }
  if (name === "shield") {
    return <svg {...props}><path d="M12 2.8 20 6v5.5c0 4.8-3.1 8.1-8 9.7-4.9-1.6-8-4.9-8-9.7V6Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>;
  }
  if (name === "history") {
    return <svg {...props}><path d="M4 7v5h5" /><path d="M5.5 17A8 8 0 1 0 4 12" /><path d="M12 7v5l3 2" /></svg>;
  }
  return <svg {...props}><path d="M4 20V5h16v15" /><path d="M7 9h10M7 13h10M7 17h6" /></svg>;
}
