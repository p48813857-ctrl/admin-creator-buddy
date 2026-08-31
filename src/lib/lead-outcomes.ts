// Shared list of lead statuses / call outcomes and their display metadata.
// The status column on leads doubles as the "latest call outcome" — updating
// it via the agent UI logs the newest outcome for that lead.
//
// "new" is kept as the stored value for pending (not-yet-worked) data so that
// existing rows and the database default keep working.

export const LEAD_STATUSES = [
  "new",
  "vv",
  "48",
  "will",
  "sd",
  "parents",
  "lc",
  "nr",
  "ni",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Pending",
  vv: "VV",
  "48": "48",
  will: "Will",
  sd: "SD",
  parents: "Parents",
  lc: "LC",
  nr: "NR",
  ni: "NI",
};

// Tailwind badge classes for on-screen chips (mirrors the export colors).
export const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-900 text-white dark:bg-blue-900 dark:text-white",
  vv: "bg-green-200 text-green-900 dark:bg-green-300 dark:text-green-950",
  "48": "bg-green-700 text-white dark:bg-green-700 dark:text-white",
  will: "bg-sky-200 text-sky-900 dark:bg-sky-300 dark:text-sky-950",
  sd: "bg-yellow-200 text-yellow-900 dark:bg-yellow-300 dark:text-yellow-950",
  parents: "bg-slate-300 text-slate-900 dark:bg-slate-400 dark:text-slate-950",
  lc: "bg-violet-500 text-white dark:bg-violet-500 dark:text-white",
  nr: "bg-red-500 text-white dark:bg-red-500 dark:text-white",
  ni: "bg-red-900 text-white dark:bg-red-900 dark:text-white",
};

// Solid ARGB hex fills used when styling exported Excel rows.
export const STATUS_EXCEL_FILLS: Record<string, string> = {
  new: "FF1E3A8A", // Pending — dark blue
  vv: "FFBBF7D0", // light green
  "48": "FF15803D", // dark green
  will: "FF7DD3FC", // sky blue
  sd: "FFFDE047", // yellow
  parents: "FFD1D5DB", // grey
  lc: "FF8B5CF6", // violet
  nr: "FFEF4444", // red
  ni: "FF7F1D1D", // dark red
};

// Font color to keep text readable on top of the fills above.
export const STATUS_EXCEL_FONT_COLORS: Record<string, string> = {
  new: "FFFFFFFF",
  vv: "FF14532D",
  "48": "FFFFFFFF",
  will: "FF0C4A6E",
  sd: "FF713F12",
  parents: "FF111827",
  lc: "FFFFFFFF",
  nr: "FFFFFFFF",
  ni: "FFFFFFFF",
};
