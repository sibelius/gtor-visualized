import { codeToHtml } from "shiki";
import clsx from "clsx";

/** Server component: highlights code at build time with Shiki. */
export async function Code({ code, lang = "js", className, title }: { code: string; lang?: string; className?: string; title?: string }) {
  const html = await codeToHtml(code.trim(), { lang, theme: "github-dark-default" });
  return (
    <div className={clsx("min-w-0 overflow-hidden rounded-lg border border-line bg-bg/60", className)}>
      {title && <div className="border-b border-line px-3 py-1.5 font-mono text-[11px] text-faint">{title}</div>}
      <div className="overflow-x-auto p-3 text-[12.5px] leading-relaxed [&_pre]:font-mono" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
