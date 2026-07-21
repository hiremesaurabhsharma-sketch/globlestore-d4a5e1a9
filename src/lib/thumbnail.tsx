import { useState } from "react";
import { Play } from "lucide-react";
import { channelGradient } from "@/lib/channel";

/**
 * Bulletproof thumbnail: tries maxres → hq → mq → default, then falls back
 * to a gradient placeholder tied to the channel so the card stays readable.
 */
export function Thumbnail({
  src,
  alt,
  channelName,
  className = "h-full w-full object-cover",
}: {
  src: string;
  alt: string;
  channelName: string;
  className?: string;
}) {
  // Data-saver: mobile / narrow viewports start at mqdefault (~15KB) instead
  // of maxresdefault (~150KB+). Desktop still gets HD. Also respect the
  // browser Save-Data hint when present.
  const initial = (() => {
    if (!src.includes("/hqdefault.")) return src;
    if (typeof window !== "undefined") {
      const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } };
      const saveData = nav.connection?.saveData;
      const slow = nav.connection?.effectiveType && /2g|3g/.test(nav.connection.effectiveType);
      const narrow = window.innerWidth < 768;
      if (saveData || slow) return src.replace("/hqdefault.", "/mqdefault.");
      if (narrow) return src; // keep hqdefault on mobile — good balance
      return src.replace("/hqdefault.", "/maxresdefault.");
    }
    return src;
  })();
  const [current, setCurrent] = useState(initial);
  const [failed, setFailed] = useState(false);

  if (failed) {
    const gradient = channelGradient(channelName);
    return (
      <div
        role="img"
        aria-label={alt}
        className={`grid h-full w-full place-items-center bg-gradient-to-br ${gradient} text-white`}
      >
        <div className="flex flex-col items-center gap-2 px-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
            <Play className="h-5 w-5 translate-x-0.5 fill-white text-white" />
          </span>
          <span className="line-clamp-2 text-xs font-semibold leading-tight drop-shadow">
            {channelName}
          </span>
        </div>
      </div>
    );
  }

  const stepDown = () => {
    if (current.includes("/maxresdefault.")) {
      setCurrent(current.replace("/maxresdefault.", "/hqdefault."));
    } else if (current.includes("/hqdefault.")) {
      setCurrent(current.replace("/hqdefault.", "/mqdefault."));
    } else if (current.includes("/mqdefault.")) {
      setCurrent(current.replace("/mqdefault.", "/default."));
    } else {
      setFailed(true);
    }
  };

  return (
    <img
      src={current}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={stepDown}
      onLoad={(e) => {
        // YouTube serves a 120x90 grey placeholder (HTTP 200) when a size
        // like maxresdefault/hqdefault doesn't exist — onError never fires.
        // Detect via naturalWidth and step down the quality chain.
        const img = e.currentTarget;
        if (
          img.naturalWidth > 0 &&
          img.naturalWidth <= 120 &&
          !current.includes("/default.")
        ) {
          stepDown();
        }
      }}
      className={className}
    />
  );
}
