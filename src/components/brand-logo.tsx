type BrandLogoProps = {
  size?: number;
  className?: string;
  title?: string;
  /** When true, render just the mark (dot). Default: full wordmark. */
  markOnly?: boolean;
};

/**
 * Spark wordmark — Vimeo-style: lowercase, heavy italic, playful.
 * The `size` prop controls the visual height in px; the wordmark scales
 * from it. Uses Nunito 900 italic (loaded in __root.tsx) with a subtle
 * brand-blue gradient fill.
 */
export function BrandLogo({
  size = 28,
  className,
  title = "spark",
  markOnly = false,
}: BrandLogoProps) {
  if (markOnly) {
    return (
      <span
        aria-label={title}
        role="img"
        className={className}
        style={{
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: "9999px",
          background:
            "linear-gradient(135deg, #5AB0FF 0%, #1D6FEB 100%)",
          boxShadow: "0 4px 14px rgba(29,111,235,0.4)",
        }}
      />
    );
  }

  return (
    <span
      aria-label={title}
      role="img"
      className={className}
      style={{
        fontFamily: "'Nunito', system-ui, sans-serif",
        fontWeight: 900,
        fontStyle: "italic",
        fontSize: `${size}px`,
        lineHeight: 1,
        letterSpacing: "-0.055em",
        display: "inline-block",
        whiteSpace: "nowrap",
        userSelect: "none",
        backgroundImage:
          "linear-gradient(100deg, #1D6FEB 0%, #5AB0FF 25%, #ffffff 45%, #5AB0FF 65%, #1D6FEB 100%)",
        backgroundSize: "220% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        animation: "spark-shine 4.5s ease-in-out infinite",
        filter: "drop-shadow(0 2px 10px rgba(29,111,235,0.25))",
      }}
    >
      spark
    </span>
  );
}

