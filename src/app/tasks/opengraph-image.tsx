import { ogAlt, ogContentType, ogSize, renderOg } from "@/lib/og";

export const alt = ogAlt("/tasks");
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOg("/tasks");
}
