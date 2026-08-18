import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  getCachedLogoState,
  logoDomain,
  logoUrl,
  setCachedLogoState,
} from "@/lib/logo-lookup";

/**
 * Store logo. Looks up the dealership's own site (or its OEM brand site) via
 * Logo.dev, with a cached result so repeat renders are instant. Falls back to
 * a coloured monogram badge whenever no logo exists or lookup is unavailable.
 */
const BRANDS: Record<string, { short: string; bg: string; fg: string }> = {
  Acura: { short: "AC", bg: "#0d1b2a", fg: "#ffffff" },
  Audi: { short: "AU", bg: "#bb0a30", fg: "#ffffff" },
  BMW: { short: "BM", bg: "#0166b1", fg: "#ffffff" },
  Cadillac: { short: "CA", bg: "#1b2a41", fg: "#e3c565" },
  Chevrolet: { short: "CH", bg: "#d1a01f", fg: "#1a1a1a" },
  Chrysler: { short: "CR", bg: "#1c3f6e", fg: "#ffffff" },
  Dodge: { short: "DG", bg: "#b3121b", fg: "#ffffff" },
  Ford: { short: "FO", bg: "#00274d", fg: "#ffffff" },
  GM: { short: "GM", bg: "#0170ce", fg: "#ffffff" },
  GMC: { short: "GC", bg: "#c8102e", fg: "#ffffff" },
  Honda: { short: "HO", bg: "#cc0000", fg: "#ffffff" },
  Hyundai: { short: "HY", bg: "#002c5f", fg: "#ffffff" },
  Infiniti: { short: "IN", bg: "#1f2933", fg: "#ffffff" },
  Kia: { short: "KI", bg: "#05141f", fg: "#ffffff" },
  Mazda: { short: "MZ", bg: "#101820", fg: "#ffffff" },
  "Mercedes-Benz": { short: "MB", bg: "#2b2f33", fg: "#ffffff" },
  Mini: { short: "MI", bg: "#111111", fg: "#ffffff" },
  Nissan: { short: "NI", bg: "#c3002f", fg: "#ffffff" },
  Porsche: { short: "PO", bg: "#0f0f0f", fg: "#d5001c" },
  Subaru: { short: "SU", bg: "#13478a", fg: "#ffffff" },
  Volkswagen: { short: "VW", bg: "#001e50", fg: "#ffffff" },
};

const SIZES = {
  sm: { cls: "h-6 w-6 text-[9px] rounded-md", px: 24 },
  md: { cls: "h-8 w-8 text-[10px] rounded-lg", px: 32 },
  lg: { cls: "h-11 w-11 text-xs rounded-xl", px: 44 },
} as const;

export function BrandMark({
  brand,
  storeId,
  size = "md",
  className,
}: {
  brand: string;
  /** Dealership id — enables store-specific (not just OEM) logo lookup. */
  storeId?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  const domain = logoDomain(brand, storeId);
  const src = domain ? logoUrl(domain, s.px) : null;

  // Start from cache: "ok" renders the image immediately with no flicker,
  // "missing" skips the network request entirely.
  const [state, setState] = useState<"pending" | "ok" | "missing">(() => {
    if (!src || !domain) return "missing";
    return getCachedLogoState(domain) ?? "pending";
  });

  useEffect(() => {
    if (!src || !domain) {
      setState("missing");
      return;
    }
    setState(getCachedLogoState(domain) ?? "pending");
  }, [src, domain]);

  const b = BRANDS[brand] ?? {
    short: brand.slice(0, 2).toUpperCase(),
    bg: "#3f4652",
    fg: "#ffffff",
  };

  if (src && domain && state !== "missing") {
    return (
      <span
        title={brand}
        className={cn(
          "inline-flex shrink-0 select-none items-center justify-center overflow-hidden bg-white ring-1 ring-black/5",
          s.cls,
          className,
        )}
      >
        <img
          src={src}
          alt={`${brand} logo`}
          loading="lazy"
          decoding="async"
          width={s.px}
          height={s.px}
          className="h-full w-full object-contain p-0.5"
          onLoad={() => {
            setCachedLogoState(domain, "ok");
            setState("ok");
          }}
          onError={() => {
            setCachedLogoState(domain, "missing");
            setState("missing");
          }}
        />
      </span>
    );
  }

  return (
    <span
      title={brand}
      aria-label={`${brand} logo`}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center font-display font-semibold tracking-wide ring-1 ring-black/5",
        s.cls,
        className,
      )}
      style={{ backgroundColor: b.bg, color: b.fg }}
    >
      {b.short}
    </span>
  );
}
