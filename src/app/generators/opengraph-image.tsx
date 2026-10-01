import { ogAlt, ogContentType, ogSize, renderOg } from "@/lib/og";

export const alt = ogAlt("/generators");
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOg("/generators");
}
