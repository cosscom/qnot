import Link from 'next/link';
import { codeToHtml } from 'shiki';
import { installedFiles, registryUrl } from '@/lib/registry';
import { InstallCommand } from './install-command';
import { SourceTabs } from './source-tabs';

/** An example's install command and full source: every file `shadcn add` would put in your project. */
export async function ExampleSource({ name }: { name: string }) {
  const files = await Promise.all(
    installedFiles(name).map(async (f) => ({
      path: f.install,
      code: f.content,
      html: await codeToHtml(f.content, { lang: f.install.endsWith('.ts') ? 'ts' : 'tsx', themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false }),
    })),
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-12 lg:items-start lg:gap-10">
        <div className="flex flex-col gap-2 lg:col-span-4">
          <h2 className="font-semibold text-2xl tracking-[-0.02em]">Add it to your project</h2>
          <p className="text-muted-foreground leading-snug">
            One command installs this example with every file and coss ui component it needs, into <code className="font-mono text-sm">components/trawlnet</code>. The code is
            yours to change; it's MIT. See{' '}
            <Link className="underline underline-offset-2 hover:text-foreground" href="/docs/guides/shadcn">
              Install with shadcn
            </Link>
            .
          </p>
        </div>
        <InstallCommand className="lg:col-span-8" url={registryUrl(name)} />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-semibold text-2xl tracking-[-0.02em]">Source</h2>
          <span className="font-mono text-muted-foreground text-xs">{files.length} files, exactly what runs above</span>
        </div>
        <SourceTabs files={files} />
      </div>
    </div>
  );
}
