import { ogAlt, ogContentType, ogSize, renderOg } from "@/lib/og";

export const alt = ogAlt("/iterators");
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOg("/iterators");
}
