import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  MapPin,
  Search,
  Users,
  ExternalLink,
  Filter,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/jobs")({
  component: JobsPage,
  head: () => ({
    meta: [
      { title: "Sarkari Jobs & Vacancies — Spark" },
      {
        name: "description",
        content:
          "Latest government job vacancies for SSC, UPSC, Railway, Banking, State PCS. Daily updates from top sources — one clean feed, no clutter.",
      },
      { property: "og:title", content: "Sarkari Jobs & Vacancies — Spark" },
      {
        property: "og:description",
        content:
          "Latest government job vacancies. Daily updates from SarkariResult, SarkariExam & more — one clean feed.",
      },
    ],
  }),
});

type Vacancy = {
  id: string;
  title: string;
  department: string;
  category: "SSC" | "UPSC" | "Railway" | "Banking" | "State PCS" | "Teaching" | "Defence";
  posts: number;
  qualification: string;
  location: string;
  lastDate: string; // ISO
  applyStart: string; // ISO
  fee: string;
  officialUrl: string;
  isNew?: boolean;
  isHot?: boolean;
};

// UI-only mock data — real data pipeline aayega baad me
const MOCK_VACANCIES: Vacancy[] = [
  {
    id: "ssc-cgl-2026",
    title: "SSC CGL 2026 — Combined Graduate Level Examination",
    department: "Staff Selection Commission",
    category: "SSC",
    posts: 17727,
    qualification: "Graduation in any stream",
    location: "All India",
    lastDate: "2026-08-24",
    applyStart: "2026-07-24",
    fee: "₹100 (Female/SC/ST/PwBD — Free)",
    officialUrl: "https://ssc.gov.in",
    isNew: true,
    isHot: true,
  },
  {
    id: "upsc-cse-2026",
    title: "UPSC Civil Services (Prelims) 2026",
    department: "Union Public Service Commission",
    category: "UPSC",
    posts: 1056,
    qualification: "Graduation",
    location: "All India",
    lastDate: "2026-08-18",
    applyStart: "2026-07-28",
    fee: "₹100 (Female/SC/ST/PwBD — Free)",
    officialUrl: "https://upsc.gov.in",
    isNew: true,
  },
  {
    id: "rrb-ntpc-2026",
    title: "RRB NTPC 2026 — Non-Technical Popular Categories",
    department: "Railway Recruitment Board",
    category: "Railway",
    posts: 11558,
    qualification: "12th / Graduation",
    location: "All India",
    lastDate: "2026-08-30",
    applyStart: "2026-08-01",
    fee: "₹500 (₹250 refundable)",
    officialUrl: "https://rrbcdg.gov.in",
    isHot: true,
  },
  {
    id: "ibps-po-2026",
    title: "IBPS PO/MT-XVI 2026 — Probationary Officer",
    department: "Institute of Banking Personnel Selection",
    category: "Banking",
    posts: 4455,
    qualification: "Graduation",
    location: "All India",
    lastDate: "2026-08-21",
    applyStart: "2026-08-01",
    fee: "₹850 (₹175 for SC/ST/PwBD)",
    officialUrl: "https://ibps.in",
    isNew: true,
  },
  {
    id: "sbi-clerk-2026",
    title: "SBI Clerk 2026 — Junior Associate",
    department: "State Bank of India",
    category: "Banking",
    posts: 13735,
    qualification: "Graduation",
    location: "All India",
    lastDate: "2026-09-07",
    applyStart: "2026-08-17",
    fee: "₹750 (SC/ST/PwBD — Free)",
    officialUrl: "https://sbi.co.in/careers",
  },
  {
    id: "uppsc-pcs-2026",
    title: "UPPSC PCS 2026 — Combined State/Upper Subordinate Services",
    department: "UP Public Service Commission",
    category: "State PCS",
    posts: 220,
    qualification: "Graduation",
    location: "Uttar Pradesh",
    lastDate: "2026-08-11",
    applyStart: "2026-07-22",
    fee: "₹125 (SC/ST — ₹65)",
    officialUrl: "https://uppsc.up.nic.in",
  },
  {
    id: "ctet-2026",
    title: "CTET July 2026 — Central Teacher Eligibility Test",
    department: "CBSE",
    category: "Teaching",
    posts: 0,
    qualification: "B.Ed / D.El.Ed",
    location: "All India",
    lastDate: "2026-08-16",
    applyStart: "2026-07-25",
    fee: "₹1000 (SC/ST/PwBD — ₹500)",
    officialUrl: "https://ctet.nic.in",
  },
  {
    id: "airforce-agniveer-2026",
    title: "Indian Air Force Agniveer Vayu Intake 02/2026",
    department: "Indian Air Force",
    category: "Defence",
    posts: 2500,
    qualification: "12th (PCM) / Diploma",
    location: "All India",
    lastDate: "2026-08-02",
    applyStart: "2026-07-11",
    fee: "₹550",
    officialUrl: "https://agnipathvayu.cdac.in",
    isHot: true,
  },
];

const CATEGORIES = [
  "All",
  "SSC",
  "UPSC",
  "Railway",
  "Banking",
  "State PCS",
  "Teaching",
  "Defence",
] as const;

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function daysLeft(iso: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function categoryColor(cat: Vacancy["category"]) {
  switch (cat) {
    case "SSC":
      return "#3b82f6";
    case "UPSC":
      return "#8b5cf6";
    case "Railway":
      return "#f97316";
    case "Banking":
      return "#10b981";
    case "State PCS":
      return "#ec4899";
    case "Teaching":
      return "#06b6d4";
    case "Defence":
      return "#ef4444";
  }
}

function JobsPage() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<(typeof CATEGORIES)[number]>("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_VACANCIES.filter((v) => {
      if (activeCat !== "All" && v.category !== activeCat) return false;
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.department.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q)
      );
    });
  }, [query, activeCat]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="klaro-header sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2 px-3 py-2 sm:gap-4 sm:px-6 sm:py-2.5">
          <Link
            to="/"
            aria-label="Back to home"
            className="hbtn grid h-10 w-10 place-items-center rounded-full transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo size={30} />
            <span
              className="hidden text-[18px] font-bold tracking-tight text-[var(--header-fg)] sm:inline"
              style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
            >
              Spark
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex"
              style={{
                backgroundColor: "rgba(239,68,68,0.12)",
                color: "#ef4444",
              }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              LIVE UPDATES
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-border/50"
        style={{
          background:
            "linear-gradient(135deg, rgba(29,111,235,0.08) 0%, rgba(90,176,255,0.04) 100%)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
          <div className="flex items-center gap-3">
            <div
              className="grid h-12 w-12 place-items-center rounded-2xl shadow-lg sm:h-14 sm:w-14"
              style={{
                background: "linear-gradient(135deg, var(--brand-2), var(--brand))",
                boxShadow: "0 10px 30px -8px rgba(29,111,235,0.5)",
              }}
            >
              <Briefcase className="h-6 w-6 text-white sm:h-7 sm:w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Sarkari Jobs & Vacancies
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                Sabhi latest government vacancies — ek clean feed me, roz update.
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-6 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                inputMode="search"
                placeholder="Search vacancies — 'SSC CGL', 'Railway', 'UPSC'..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-full border border-border bg-background py-3 pl-12 pr-4 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 sm:text-base"
              />
            </div>
            <button
              type="button"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-border bg-background shadow-sm transition hover:bg-accent sm:hidden"
              aria-label="Filter"
            >
              <Filter className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Category chips */}
      <div className="sticky top-[54px] z-20 border-b border-border/50 bg-background/95 backdrop-blur sm:top-[58px]">
        <div className="mx-auto max-w-6xl overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2">
            {CATEGORIES.map((cat) => {
              const active = activeCat === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCat(cat)}
                  className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition"
                  style={
                    active
                      ? {
                          background: "linear-gradient(135deg, var(--brand-2), var(--brand))",
                          color: "#fff",
                          boxShadow: "0 4px 14px rgba(29,111,235,0.35)",
                        }
                      : {
                          backgroundColor: "var(--header-surface)",
                          color: "var(--foreground)",
                        }
                  }
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Vacancy grid */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">
              Koi vacancy nahi mili — dusra keyword try karo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {filtered.map((v) => (
              <VacancyCard key={v.id} vacancy={v} />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function VacancyCard({ vacancy: v }: { vacancy: Vacancy }) {
  const days = daysLeft(v.lastDate);
  const urgent = days >= 0 && days <= 7;
  const closed = days < 0;
  const catColor = categoryColor(v.category);

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-[var(--brand)]/30 hover:shadow-xl"
    >
      {/* Top strip */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
          style={{
            backgroundColor: `${catColor}18`,
            color: catColor,
          }}
        >
          {v.category}
        </span>
        <div className="flex items-center gap-1">
          {v.isNew && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: "#10b981" }}
            >
              NEW
            </span>
          )}
          {v.isHot && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: "#ef4444" }}
            >
              🔥 HOT
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h2 className="line-clamp-2 text-base font-bold leading-snug text-foreground sm:text-lg">
        {v.title}
      </h2>
      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{v.department}</p>

      {/* Divider */}
      <div className="my-4 h-px bg-border" />

      {/* Details */}
      <ul className="space-y-2 text-sm">
        {v.posts > 0 && (
          <li className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <strong className="font-bold text-foreground">
                {v.posts.toLocaleString("en-IN")}
              </strong>{" "}
              posts
            </span>
          </li>
        )}
        <li className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-foreground">{v.location}</span>
        </li>
        <li className="flex items-start gap-2">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-foreground">
            Last date: <strong className="font-semibold">{formatDate(v.lastDate)}</strong>
          </span>
        </li>
      </ul>

      {/* Countdown pill */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
          style={
            closed
              ? { backgroundColor: "rgba(100,116,139,0.15)", color: "#64748b" }
              : urgent
                ? { backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444" }
                : { backgroundColor: "rgba(16,185,129,0.15)", color: "#10b981" }
          }
        >
          {closed ? "Closed" : urgent ? `⚡ ${days} din baaki` : `${days} din baaki`}
        </span>
        <a
          href={v.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white shadow-md transition hover:shadow-lg"
          style={{
            background: "linear-gradient(135deg, var(--brand-2), var(--brand))",
          }}
        >
          Apply
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  );
}
