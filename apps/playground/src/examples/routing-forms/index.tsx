import { RouteIcon } from 'lucide-react';
import { ExampleFrame, type ExampleMeta } from '../frame';
import { RoutingFormsApp } from './RoutingForms';

export const meta: ExampleMeta = {
  id: 'routing-forms',
  title: 'Cal.com routing forms',
  blurb: 'Route form responses to events, pages or the right team member',
  icon: RouteIcon,
  category: 'Product',
};

const code = `
import { createQueryStore, compile } from '@trawlnet/core';

// The form's questions are the schema.
const formFields = defineFields({
  visaType: f.enum([{ value: 'o1', label: 'O-1 extraordinary ability' }, …]),
  companySize: f.number({ min: 1 }),
  urgency: f.enum([{ value: 'asap', label: 'Within 2 weeks' }, …]),
});

// Each route owns a store; the UI is <CossQueryBuilder combinatorStyle="sentence" compact />.
const routes = [
  { name: 'Extraordinary talent', store: createQueryStore({ fields: formFields, initial }), action },
  …
];

// "all / any / none" is just the group's combinator and NOT flag:
//   all  -> { combinator: 'and' }
//   any  -> { combinator: 'or' }
//   none -> { combinator: 'or', not: true }

// First match wins, else the fallback.
const route = routes.find((r) => compile(formFields, r.store.getQuery())(response));
const action = route?.action ?? fallback;

// Assign hosts by attributes with a second schema + store per route.
const hosts = team.filter(compile(attributeFields, route.assign.store.getQuery()));
`;

export function Demo() {
  return (
    <ExampleFrame
      meta={meta}
      bleed
      code={code}
      description={
        <>
          A replica of Cal.com's routing form editor. Every route is its own trawlnet store over the form's questions;
          <strong className="font-medium text-foreground"> all / any / none</strong> map to AND, OR and NOT(OR). The second builder filters team members by their attributes.
          Hit <strong className="font-medium text-foreground">Preview</strong> to answer the form and watch the first matching route win, or open <strong className="font-medium text-foreground">Reports</strong> to see sample responses routed live.
        </>
      }
    >
      <RoutingFormsApp />
    </ExampleFrame>
  );
}
