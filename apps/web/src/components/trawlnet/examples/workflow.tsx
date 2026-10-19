// Part of trawlnet (https://github.com/sean-brydon/trawlnet). MIT licensed; installable with shadcn.
'use client';
import { compile, defineFields, f, type RowOf } from '@trawlnet/core';
import { BellIcon, CalendarPlusIcon, MailIcon, MessageSquareIcon, WebhookIcon, ZapIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CossSelect } from '@/components/trawlnet/controls';
import { CossQueryBuilder } from '@/components/trawlnet/query-builder';
import { cn } from '@/lib/utils';
import { useExampleStore, useLiveQuery } from '@/components/trawlnet/examples/shared';



const fields = defineFields({
  eventType: f.enum(['Intro call', 'Product demo', 'Interview', 'Support session'], { label: 'Event type' }),
  team: f.enum(['Sales', 'Success', 'Recruiting', 'Support']),
  durationMin: f.number({ label: 'Duration (min)', min: 5 }),
  startsInHours: f.number({ label: 'Starts in (hours)', min: 0 }),
  firstBooking: f.boolean({ label: 'First booking' }),
  paid: f.boolean({ label: 'Paid' }),
  attendeeEmail: f.text({ label: 'Attendee email' }),
  attendeeCountry: f.enum(['US', 'GB', 'DE', 'IN', 'BR'], { label: 'Attendee country' }),
});

const TRIGGERS = [
  { value: 'created', label: 'Booking created' },
  { value: 'rescheduled', label: 'Booking rescheduled' },
  { value: 'cancelled', label: 'Booking cancelled' },
];
const ACTIONS = [
  { value: 'email', label: 'Send email' },
  { value: 'sms', label: 'Send SMS' },
  { value: 'webhook', label: 'Call webhook' },
];

const EVENTS: (RowOf<typeof fields> & { trigger: string; who: string })[] = [
  { trigger: 'created', who: 'maya@northwind.io', eventType: 'Product demo', team: 'Sales', durationMin: 45, startsInHours: 20, firstBooking: true, paid: false, attendeeEmail: 'maya@northwind.io', attendeeCountry: 'US' },
  { trigger: 'created', who: 'jonas@kiel.de', eventType: 'Intro call', team: 'Sales', durationMin: 15, startsInHours: 3, firstBooking: false, paid: false, attendeeEmail: 'jonas@kiel.de', attendeeCountry: 'DE' },
  { trigger: 'rescheduled', who: 'arjun@quant.co', eventType: 'Product demo', team: 'Sales', durationMin: 45, startsInHours: 50, firstBooking: false, paid: false, attendeeEmail: 'arjun@quant.co', attendeeCountry: 'IN' },
  { trigger: 'created', who: 'li@gmail.com', eventType: 'Interview', team: 'Recruiting', durationMin: 60, startsInHours: 72, firstBooking: true, paid: false, attendeeEmail: 'li@gmail.com', attendeeCountry: 'GB' },
  { trigger: 'created', who: 'ops@vandelay.com', eventType: 'Support session', team: 'Support', durationMin: 30, startsInHours: 1, firstBooking: false, paid: true, attendeeEmail: 'ops@vandelay.com', attendeeCountry: 'US' },
  { trigger: 'cancelled', who: 'bea@hooli.com', eventType: 'Product demo', team: 'Sales', durationMin: 45, startsInHours: 6, firstBooking: true, paid: false, attendeeEmail: 'bea@hooli.com', attendeeCountry: 'BR' },
  { trigger: 'created', who: 'sam@acme.dev', eventType: 'Product demo', team: 'Sales', durationMin: 60, startsInHours: 26, firstBooking: true, paid: false, attendeeEmail: 'sam@acme.dev', attendeeCountry: 'US' },
];

function Step({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background p-3 shadow-xs/5">
      <div className="flex items-center gap-2 font-medium text-sm">
        <span className="flex size-7 items-center justify-center rounded-md border bg-muted/50 [&_svg]:size-3.5">{icon}</span>
        {label}
      </div>
      {children}
    </div>
  );
}


export function Demo() {
  const store = useExampleStore(fields, {
    kind: 'group',
    combinator: 'and',
    children: [
      { kind: 'rule', field: 'eventType', operator: 'eq', value: 'Product demo' },
      { kind: 'rule', field: 'firstBooking', operator: 'eq', value: true },
      { kind: 'rule', field: 'attendeeEmail', operator: 'notContains', value: 'gmail.com' },
    ],
  });
  const query = useLiveQuery(store);
  const [trigger, setTrigger] = useState('created');
  const [action, setAction] = useState('email');
  const [target, setTarget] = useState('{attendee.email}');
  const results = useMemo(() => {
    const cond = compile(fields, query);
    return EVENTS.map((e) => ({ e, triggerOk: e.trigger === trigger, condOk: cond(e) }));
  }, [query, trigger]);
  const ActionIcon = action === 'email' ? MailIcon : action === 'sms' ? MessageSquareIcon : WebhookIcon;

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <Step icon={<ZapIcon />} label="When">
            <CossSelect className="w-60" items={TRIGGERS} value={trigger} onChange={setTrigger} />
          </Step>
          <div aria-hidden className="ms-6 h-3 w-px bg-border" />
          <Step icon={<CalendarPlusIcon />} label="And">
            <CossQueryBuilder store={store} combinatorStyle="sentence" compact allowGroups labels={{ sentenceBefore: 'Only if', sentenceAfter: 'of these conditions match', addRule: 'Add condition', addGroup: 'Add group' }} />
          </Step>
          <div aria-hidden className="ms-6 h-3 w-px bg-border" />
          <Step icon={<BellIcon />} label="Then">
            <div className="grid gap-2 sm:grid-cols-2">
              <CossSelect className="w-full" items={ACTIONS} value={action} onChange={setAction} />
              <Input size="sm" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={action === 'webhook' ? 'https://' : 'Recipient'} />
            </div>
          </Step>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-medium text-sm">
            Recent bookings
            <Badge variant="success">{results.filter((r) => r.triggerOk && r.condOk).length} would run</Badge>
          </div>
          {results.map(({ e, triggerOk, condOk }, i) => {
            const runs = triggerOk && condOk;
            return (
              <div key={i} className={cn('flex flex-col gap-1 rounded-xl border px-3 py-2', runs ? 'border-success/40 bg-success/8' : 'opacity-75')} data-runs={runs}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{e.eventType}</span>
                  <span className="text-muted-foreground text-xs">· {e.trigger}</span>
                  {runs ? (
                    <Badge variant="success" className="ms-auto">
                      <ActionIcon className="size-3" /> runs
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ms-auto">
                      {triggerOk ? 'conditions fail' : 'other trigger'}
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground text-xs">
                  {e.who} · {e.team} · {e.durationMin}m · in {e.startsInHours}h{e.firstBooking ? ' · first booking' : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
