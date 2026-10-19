import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import type { FaqItem } from '@/components/seo/blocks';
import { KitPage } from '@/components/seo/kit-page';

export const metadata: Metadata = pageMetadata({
  title: 'MUI Query Builder: open-source, Material UI components',
  description:
    'A query builder made of Material UI components: TextField, Select, Autocomplete. MIT licensed, installs as source with one shadcn command. No MUI X license.',
  path: '/mui-query-builder',
});

export const faq: FaqItem[] = [
  {
    q: 'Is it free? Does it need MUI X?',
    a: 'Yes, and no. The builder is MIT licensed and uses only @mui/material and @mui/icons-material (both MIT) with Emotion. No MUI X package or license is involved.',
  },
  {
    q: 'Do I need to use shadcn to install it?',
    a: 'Only the CLI, once: shadcn add copies the file into your project and installs the npm packages. It needs a components.json, which shadcn init creates; you do not have to use any shadcn/ui components afterwards.',
    links: [{ href: '/docs/guides/shadcn', label: 'Install with shadcn' }],
  },
  {
    q: 'Does it follow my MUI theme?',
    a: 'It wraps itself in its own ThemeProvider and picks light or dark from the dark class on <html>, so it works without your theme or CssBaseline. To match your app, edit themeFor in the installed file, or remove the wrapper and let it inherit your theme.',
  },
  {
    q: 'Which MUI version is it built for?',
    a: 'This site runs it on @mui/material 9.5. It imports components by path (@mui/material/Autocomplete and so on), which keeps the bundle to what it uses.',
  },
  {
    q: 'Does it work with the Next.js App Router?',
    a: "Yes. The builder is a client component. If you use MUI elsewhere on the page, keep your usual AppRouterCacheProvider from @mui/material-nextjs so Emotion's styles are collected on the server.",
  },
  {
    q: 'How do I get SQL or a MongoDB filter out of it?',
    a: 'The store holds the query as plain JSON. Encode it with a codec from @qnot/core/formats: sqlFormat({ dialect: "postgres", params: "numbered" }) gives SQL with bound parameters; mongo and jsonlogic give filters.',
    links: [{ href: '/docs/concepts/formats', label: 'Formats' }],
  },
];

export default function Page() {
  return (
    <KitPage
      path="/mui-query-builder"
      component="QueryBuilder"
      facts={[
        ['license', 'MIT'],
        ['needs', '@mui/material + Emotion'],
        ['MUI X', 'Not required'],
        ['install', 'One shadcn add'],
      ]}
      faq={faq}
      importLine="import { QueryBuilder } from '@/components/qnot/kits/mui';"
      kit="mui"
      lede="A query builder made of Material UI components: TextField, Select, Autocomplete, ToggleButtonGroup. MIT, no MUI X license, one command to install as source."
      name="MUI"
      notes={
        <>
          <p>
            Pickers are MUI <code>Select</code>s and <code>Autocomplete</code>s, values are <code>TextField</code>s, AND / OR is a <code>ToggleButtonGroup</code>, and
            the add menu is a <code>Menu</code>. All of it sits on <Link href="/docs/reference/hooks">@qnot/react's hooks</Link>, which own the state.
          </p>
          <p>
            Read the query with the store's <code>onChange</code>, <code>useQuery()</code> or <code>store.getQuery()</code>, and encode it with any{' '}
            <Link href="/docs/concepts/formats">format</Link>.
          </p>
        </>
      }
      setup={
        <p>
          Installs <code>@mui/material</code>, <code>@mui/icons-material</code> and Emotion. The builder wraps itself in its own <code>ThemeProvider</code> (light or dark from
          the <code>dark</code> class on <code>&lt;html&gt;</code>), so it needs neither your theme nor <code>CssBaseline</code>; edit <code>themeFor</code> in the file to
          match your app.
        </p>
      }
      tags={['MIT', 'Material UI', 'Emotion', 'React 18+']}
      title="MUI query builder"
    />
  );
}
