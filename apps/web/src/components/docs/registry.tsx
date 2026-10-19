import { InstallCommand } from '@/components/catalog/install-command';
import { registryItems, registryUrl } from '@/lib/registry';

/** `shadcn add` for one registry item, at this deployment's URL. */
export function RegistryInstall({ name }: { name: string }) {
  return <InstallCommand className="my-6" url={registryUrl(name)} />;
}

/** Every item in the registry: what it is and what lands in your project. */
export function RegistryItems() {
  return (
    <div className="my-6 overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-2 text-left font-medium">Item</th>
            <th className="px-4 py-2 text-left font-medium">What it is</th>
            <th className="px-4 py-2 text-left font-medium">Installs</th>
          </tr>
        </thead>
        <tbody>
          {registryItems().map((item) => (
            <tr className="border-b align-top last:border-b-0" key={item.name}>
              <td className="px-4 py-2">
                <code className="font-mono text-xs">{item.name}</code>
              </td>
              <td className="px-4 py-2 text-muted-foreground">{item.description}</td>
              <td className="px-4 py-2 font-mono text-muted-foreground text-xs">
                {item.files.map((f) => (
                  <div key={f.path}>{f.install}</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
