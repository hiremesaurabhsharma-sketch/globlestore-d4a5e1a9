export type ExamCategory = {
  id: string;
  label: string;
  keywords: string[];
};

export const EXAM_CATEGORIES: ExamCategory[] = [
  { id: "all", label: "All", keywords: [] },
  { id: "upsc", label: "UPSC", keywords: ["upsc", "ias", "civil service", "prelims", "mains", "vajiram", "vision ias", "drishti", "forum ias", "insight"] },
  { id: "ssc", label: "SSC", keywords: ["ssc", "cgl", "chsl", "mts", "gd constable", "staff selection"] },
  { id: "neet", label: "NEET", keywords: ["neet", "aiims", "biology", "physics wallah neet", "allen neet", "aakash neet"] },
  { id: "jee", label: "JEE", keywords: ["jee", "iit", "jee main", "jee advanced", "physics wallah jee", "allen jee", "aakash jee"] },
  { id: "state-pcs", label: "State PCS", keywords: ["pcs", "bpsc", "uppcs", "mppsc", "rpsc", "tnpsc", "kpsc", "wbcs", "mpsc", "state pcs"] },
  { id: "banking", label: "Banking", keywords: ["banking", "ibps", "sbi po", "sbi clerk", "rbi", "nabard"] },
];

/** Returns the ids of every category a video matches (excluding "all"). */
export function categoriesFor(video: { title: string; channel_name: string }): string[] {
  const hay = `${video.title} ${video.channel_name}`.toLowerCase();
  const ids: string[] = [];
  for (const c of EXAM_CATEGORIES) {
    if (c.id === "all" || c.keywords.length === 0) continue;
    if (c.keywords.some((k) => hay.includes(k))) ids.push(c.id);
  }
  return ids;
}
