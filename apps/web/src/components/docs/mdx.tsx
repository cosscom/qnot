// Adapted from cosscom/coss apps/site/src/components/mdx.tsx and docs-table.tsx (AGPL-3.0); see NOTICE.md.
import Link from 'fumadocs-core/link';
import * as Twoslash from 'fumadocs-twoslash/ui';
import { CodeBlock, type CodeBlockProps, CodeBlockTab, CodeBlockTabs, CodeBlockTabsList, CodeBlockTabsTrigger, Pre } from 'fumadocs-ui/components/codeblock';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { AlertCircleIcon, InfoIcon, LightbulbIcon, TriangleAlertIcon } from 'lucide-react';
import type { MDXComponents } from 'mdx/types';
import type { ComponentProps, ReactNode } from 'react';
import { RegistryInstall, RegistryItems } from '@/components/docs/registry';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type CalloutType = 'info' | 'warn' | 'warning' | 'error' | 'success' | 'idea' | 'tip';

const CALLOUT_VARIANTS: Record<CalloutType, ComponentProps<typeof Alert>['variant']> = {
  info: 'info',
  warn: 'warning',
  warning: 'warning',
  error: 'error',
  success: 'success',
  idea: 'default',
  tip: 'default',
};

/** `<Callout type="warn">` in MDX, as a coss ui alert. */
function Callout({ type = 'info', title, className, children, ...props }: Omit<ComponentProps<typeof Alert>, 'title'> & { type?: CalloutType; title?: ReactNode }) {
  const Icon = type === 'error' ? AlertCircleIcon : type === 'warn' || type === 'warning' ? TriangleAlertIcon : type === 'idea' || type === 'tip' ? LightbulbIcon : InfoIcon;
  return (
    <Alert className={cn('my-6', className)} variant={CALLOUT_VARIANTS[type]} {...props}>
      <Icon />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="[&_p]:m-0">{children}</AlertDescription>
    </Alert>
  );
}

function Cards({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('my-6 grid gap-4 sm:grid-cols-2', className)} {...props} />;
}

function LinkCard({
  title,
  description,
  href,
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof Card>, 'title'> & { title: ReactNode; description?: ReactNode; href?: string }) {
  const text = description ?? children;
  return (
    <Card className={cn('transition-colors hover:bg-accent/50', className)} render={href ? <Link href={href} /> : undefined} {...props}>
      <CardHeader className="p-5">
        <CardTitle className="text-base">{title}</CardTitle>
        {text && <CardDescription className="[&_p]:m-0">{text}</CardDescription>}
      </CardHeader>
    </Card>
  );
}

function heading(as: 'h2' | 'h3', className: string) {
  return function Heading({ className: own, children, ...props }: ComponentProps<'h2'>) {
    const Tag = as;
    return (
      <Tag className={cn(className, own)} {...props}>
        {props.id ? (
          <a className="no-underline underline-offset-4 hover:underline" href={`#${props.id}`}>
            {children}
          </a>
        ) : (
          children
        )}
      </Tag>
    );
  };
}

/** Tables in docs content scroll inside a coss ScrollArea, never with a native scrollbar. */
function DocsTable({ className, ...props }: ComponentProps<'table'>) {
  return (
    <ScrollArea className="my-6 rounded-xl border" clampContentMinWidth={false} scrollbarGutter>
      <table className={cn('relative w-full border-none text-sm', className)} {...props} />
    </ScrollArea>
  );
}

/** Components available in every MDX page without an import. */
export function getMDXComponents(components?: MDXComponents) {
  return {
    ...Twoslash,
    Callout,
    Card: LinkCard,
    Cards,
    RegistryInstall,
    RegistryItems,
    CodeBlockTab,
    CodeBlockTabs: ({ className, ...props }: ComponentProps<typeof CodeBlockTabs>) => <CodeBlockTabs className={cn('my-6 rounded-xl bg-code shadow-none', className)} {...props} />,
    CodeBlockTabsList,
    CodeBlockTabsTrigger,
    Step,
    Steps,
    Tab,
    Tabs,
    a: ({ className, ...props }: ComponentProps<typeof Link>) => <Link className={cn('font-medium text-foreground underline underline-offset-4', className)} {...props} />,
    blockquote: ({ className, ...props }: ComponentProps<'blockquote'>) => <blockquote className={cn('mt-6 border-l-2 ps-6 italic', className)} {...props} />,
    code: ({ className, ...props }: ComponentProps<'code'>) =>
      typeof props.children === 'string' ? (
        <code className={cn('relative rounded-md bg-muted px-[0.3rem] py-[0.2rem] font-mono text-[.8125rem] text-foreground/80 outline-none', className)} {...props} />
      ) : (
        <code className={className} {...props} />
      ),
    h1: ({ className, ...props }: ComponentProps<'h1'>) => <h1 className={cn('mt-2 scroll-m-20 font-heading font-semibold text-3xl', className)} {...props} />,
    h2: heading('h2', 'mt-12 scroll-m-20 font-heading font-semibold text-2xl tracking-[-0.01em] first:mt-0 lg:mt-16 [&+p]:mt-4! *:[code]:text-2xl'),
    h3: heading('h3', 'mt-8 scroll-m-20 font-semibold text-lg *:[code]:text-lg'),
    h4: ({ className, ...props }: ComponentProps<'h4'>) => <h4 className={cn('mt-8 scroll-m-20 font-medium tracking-tight', className)} {...props} />,
    hr: (props: ComponentProps<'hr'>) => <hr className="my-4 md:my-8" {...props} />,
    li: ({ className, ...props }: ComponentProps<'li'>) => <li className={cn('mt-2', className)} {...props} />,
    ol: ({ className, ...props }: ComponentProps<'ol'>) => <ol className={cn('my-6 ms-6 list-decimal text-muted-foreground', className)} {...props} />,
    p: ({ className, ...props }: ComponentProps<'p'>) => <p className={cn('not-first:mt-6 text-muted-foreground leading-relaxed', className)} {...props} />,
    pre: ({ className, children, ...props }: CodeBlockProps) => (
      <CodeBlock className={cn('my-6', className)} {...props}>
        <Pre>{children}</Pre>
      </CodeBlock>
    ),
    strong: ({ className, ...props }: ComponentProps<'strong'>) => <strong className={cn('font-medium text-foreground', className)} {...props} />,
    table: DocsTable,
    th: ({ className, ...props }: ComponentProps<'th'>) => (
      <th className={cn('border-b bg-muted/40 px-4 py-2 text-left font-medium [[align=center]]:text-center [[align=right]]:text-right', className)} {...props} />
    ),
    td: ({ className, ...props }: ComponentProps<'td'>) => (
      <td className={cn('px-4 py-2 text-left align-top text-muted-foreground [[align=center]]:text-center [[align=right]]:text-right', className)} {...props} />
    ),
    tr: ({ className, ...props }: ComponentProps<'tr'>) => <tr className={cn('m-0 border-b last:border-b-0', className)} {...props} />,
    ul: ({ className, ...props }: ComponentProps<'ul'>) => <ul className={cn('my-6 ms-6 list-disc text-muted-foreground', className)} {...props} />,
    ...components,
  } satisfies MDXComponents;
}

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
