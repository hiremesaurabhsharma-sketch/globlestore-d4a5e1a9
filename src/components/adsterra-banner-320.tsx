import { useEffect, useRef, useState } from "react";

/**
 * Adsterra Native Banner (constrained to a single clean card).
 *
 * Adsterra's native script normally renders a full GRID of ad items in one
 * container. We constrain the container via CSS so only the first item is
 * visible — this keeps the layout clean and prevents the "3 ads stacked"
 * look. Also singleton-guarded so the same zone doesn't try to mount twice.
 */
let mountedCount = 0;

type Props = {
  /**
   * If true, the ad is styled like a video card (aspect ratio matches
   * recommendation cards) — used for the in-feed placement.
   */
  cardLike?: boolean;
  className?: string;
};

export function AdsterraBanner320({ cardLike = false, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (mountedCount > 0) return;
    mountedCount += 1;
    setActive(true);

    return () => {
      mountedCount -= 1;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const el = containerRef.current;
    if (!el || el.dataset.loaded === "1") return;
    el.dataset.loaded = "1";

    const SRC =
      "https://pl30441052.effectivecpmnetwork.com/9cddd4ae7246d9b543a7026df269ae8b/invoke.js";

    if (!document.querySelector(`script[src="${SRC}"]`)) {
      const s = document.createElement("script");
      s.async = true;
      s.setAttribute("data-cfasync", "false");
      s.src = SRC;
      document.body.appendChild(s);
    }
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      className={`adsterra-single relative w-full ${
        cardLike ? "" : "my-4"
      } ${className}`}
    >
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
        Sponsored
      </div>
      <div id="container-9cddd4ae7246d9b543a7026df269ae8b" />
      {/* Constrain Adsterra native output to a single clean card */}
      <style>{`
        .adsterra-single #container-9cddd4ae7246d9b543a7026df269ae8b > *:not(:first-child) {
          display: none !important;
        }
        .adsterra-single #container-9cddd4ae7246d9b543a7026df269ae8b > *:first-child {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
        }
      `}</style>
    </div>
  );
}
