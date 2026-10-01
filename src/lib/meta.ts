import type { Metadata } from "next";
import { DESCRIPTIONS, NAV } from "@/components/shell/nav";

export const SITE_NAME = "GTOR, visualized";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gtor-visualized.vercel.app";

/**
 * Title, description and share cards for a page. Child metadata replaces the
 * layout's openGraph/twitter objects wholesale, so every page sets them all.
 * The image itself comes from the segment's opengraph-image.tsx.
 */
export function pageMetadata(href: string): Metadata {
  const item = NAV.find((n) => n.href === href)!;
  const title = href === "/" ? SITE_NAME : `${item.label} · ${SITE_NAME}`;
  const description = DESCRIPTIONS[href];
  return {
    title,
    description,
    alternates: { canonical: href },
    openGraph: { title, description, url: href, siteName: SITE_NAME, type: "website", locale: "en_US" },
    twitter: { card: "summary_large_image", title, description },
  };
}
