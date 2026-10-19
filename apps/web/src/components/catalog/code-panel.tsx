import { codeToHtml } from 'shiki';
import { ScrollBox } from '@/components/qnot/scroll-box';
import { cn } from '@/lib/utils';

/** Server-highlighted code in the coss code block look, scrolling inside a content-sized ScrollBox. */
export async function CodePanel({ code, lang = 'tsx', title, className }: { code: string; lang?: string; title?: string; className?: string }) {
  const html = await codeToHtml(code.trim(), { lang, themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false });
  return (
    <figure className={cn('overflow-hidden rounded-xl border bg-code', className)}>
      {title && <figcaption className="border-b px-4 py-2 font-mono text-muted-foreground text-xs">{title}</figcaption>}
      <ScrollBox viewportClassName="max-h-[32rem]">
        <div
          className="text-[0.8125rem] leading-relaxed [&_.shiki]:bg-transparent! [&_.shiki]:p-4 [&_.shiki_span]:text-(--shiki-light) dark:[&_.shiki_span]:text-(--shiki-dark) [&_pre]:w-max [&_pre]:min-w-full"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki output of our own source
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </ScrollBox>
    </figure>
  );
}
