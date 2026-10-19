import Link from 'next/link';
import { RegistrySource } from './registry-source';

/** An example's install command and full source: every file `shadcn add` would put in your project. */
export function ExampleSource({ name }: { name: string }) {
  return (
    <RegistrySource
      intro={
        <p>
          One command installs this example with every file and coss ui component it needs, into <code className="font-mono text-sm">components/trawlnet</code>. The code is
          yours to change; it's MIT. See{' '}
          <Link className="underline underline-offset-2 hover:text-foreground" href="/docs/guides/shadcn">
            Install with shadcn
          </Link>
          .
        </p>
      }
      name={name}
      title="Add it to your project"
    />
  );
}
