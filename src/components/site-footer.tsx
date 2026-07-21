import { Link } from "@tanstack/react-router";
import { BrandLogo } from "./brand-logo";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-white/10 bg-[#0a0f1e] text-neutral-300">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="inline-flex items-baseline gap-2.5">
              <BrandLogo size={38} className="self-center" />
            </Link>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-400">
              A distraction-free, ad-free learning feed built for serious
              aspirants. Focused. Sharp. Curated.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-2)]">
              Explore
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-neutral-400">
              <li><Link to="/" className="transition hover:text-white">Home Feed</Link></li>
              <li><Link to="/library/subscriptions" className="transition hover:text-white">Subscriptions</Link></li>
              <li><Link to="/library/playlists" className="transition hover:text-white">Playlists</Link></li>
              <li><Link to="/library/liked" className="transition hover:text-white">Liked</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-2)]">
              Exams
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-neutral-400">
              <li>SSC · UPSC</li>
              <li>NEET · JEE</li>
              <li>State PCS</li>
              <li>Banking & Railways</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-5 text-xs text-neutral-500 sm:flex-row sm:items-center">
          <p>© {year} Spark. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--brand)", boxShadow: "0 0 8px var(--brand)" }}
            />
            Built for focus.
          </p>
        </div>
      </div>
    </footer>
  );
}
