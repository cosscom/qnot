import { codeToHtml } from 'shiki';
import { installedFiles, registryUrl } from '@/lib/registry';
import { InstallCommand } from './install-command';
import { SourceTabs } from './source-tabs';

/** A registry item's `shadcn add` command and every file it installs, named by where they land. */
export async function RegistrySource({ name, title, intro, setup }: { name: string; title: string; intro: React.ReactNode; setup?: React.ReactNode }) {
  const files = await Promise.all(
    installedFiles(name).map(async (f) => ({
      path: f.install,
      code: f.content,
      html: await codeToHtml(f.content, { lang: f.install.endsWith('.ts') ? 'ts' : 'tsx', themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false }),
    })),
  );
  return (
    <div className="flex flex-col gap-6" data-registry-source={name}>
      <div className="grid gap-4 lg:grid-cols-12 lg:items-start lg:gap-10">
        <div className="flex flex-col gap-2 lg:col-span-4">
          <h2 className="font-semibold text-2xl tracking-[-0.02em]">{title}</h2>
          <div className="text-muted-foreground leading-snug">{intro}</div>
        </div>
        <div className="flex flex-col gap-3 lg:col-span-8">
          <InstallCommand url={registryUrl(name)} />
          {setup && <div className="rounded-xl border bg-muted/30 px-4 py-3 text-muted-foreground text-sm leading-relaxed [&_code]:font-mono [&_code]:text-foreground [&_code]:text-xs">{setup}</div>}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-semibold text-2xl tracking-[-0.02em]">Source</h2>
          <span className="font-mono text-muted-foreground text-xs">{files.length} files, exactly what installs</span>
        </div>
        <SourceTabs files={files} />
      </div>
    </div>
  );
}
