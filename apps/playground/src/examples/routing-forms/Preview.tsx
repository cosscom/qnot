import { compile } from '@trawlnet/core';
import { ArrowRightIcon, CircleCheckIcon, CircleDashedIcon, SparklesIcon, UsersIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberField, NumberFieldGroup, NumberFieldInput } from '@/components/ui/number-field';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { Sheet, SheetDescription, SheetHeader, SheetPanel, SheetPopup, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { CossSelect, toItems } from '@/coss/controls';
import { cn } from '@/lib/utils';
import { SAMPLE_RESPONSES, formFields, qualifyingMembers, type FormResponse, type Route, type RouteAction } from './data';
import { describeAction, useRouteTicks } from './RoutingForms';

type Answers = Record<string, unknown>;

function Question({ name, value, onChange }: { name: keyof typeof formFields; value: unknown; onChange: (v: unknown) => void }) {
  const def = formFields[name];
  const type = String(def.meta?.type ?? def.kind);
  const id = `q-${name}`;
  let control;
  if (type === 'Radio' && def.options) {
    control = (
      <RadioGroup value={value ?? null} onValueChange={onChange} className="flex flex-wrap gap-x-4 gap-y-2">
        {def.options.map((o) => (
          <Label key={String(o.value)} className="font-normal">
            <Radio value={o.value} /> {o.label}
          </Label>
        ))}
      </RadioGroup>
    );
  } else if (def.options) {
    control = <CossSelect className="w-full" size="default" items={toItems(def.options)} value={value == null ? null : String(value)} placeholder="Select…" onChange={onChange} />;
  } else if (def.kind === 'number') {
    control = (
      <NumberField value={typeof value === 'number' ? value : null} onValueChange={(v) => onChange(v)}>
        <NumberFieldGroup>
          <NumberFieldInput id={id} className="text-left" />
        </NumberFieldGroup>
      </NumberField>
    );
  } else if (type === 'Long text') {
    control = <Textarea id={id} rows={2} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  } else {
    control = <Input id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {def.label}
        {def.required && <span className="text-destructive-foreground">*</span>}
      </Label>
      {control}
    </div>
  );
}

export function PreviewSheet({ open, onOpenChange, routes, fallback }: { open: boolean; onOpenChange: (o: boolean) => void; routes: Route[]; fallback: RouteAction }) {
  const [answers, setAnswers] = useState<Answers>(() => ({ ...SAMPLE_RESPONSES[0] }));
  const tick = useRouteTicks(routes);

  const result = useMemo(() => {
    const checks = routes.map((r) => ({ route: r, hit: compile(formFields, r.store.getQuery())(answers as FormResponse) }));
    const winner = checks.find((c) => c.hit)?.route ?? null;
    const members = winner?.assign.enabled ? qualifyingMembers(winner.assign.store.getQuery()) : null;
    return { checks, winner, members };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, answers, tick]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPopup side="right" className="w-full max-w-[min(100vw,880px)]">
        <SheetHeader>
          <SheetTitle>Preview routing</SheetTitle>
          <SheetDescription>Answer the form as a respondent would and see where they end up. Routes are checked top to bottom.</SheetDescription>
        </SheetHeader>
        <SheetPanel className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_RESPONSES.slice(0, 5).map((r) => (
                <Button key={r.email} size="xs" variant="outline" onClick={() => setAnswers({ ...r })}>
                  {r.fullName}
                </Button>
              ))}
            </div>
            {(Object.keys(formFields) as (keyof typeof formFields)[]).map((name) => (
              <Question key={name} name={name} value={answers[name]} onChange={(v) => setAnswers((a) => ({ ...a, [name]: v }))} />
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border bg-muted/40 p-4 dark:bg-muted/20" data-preview-result>
              <div className="mb-2 flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                <SparklesIcon className="size-3.5" /> Result
              </div>
              <div className="font-semibold text-lg" data-winner>
                {result.winner ? result.winner.name : 'No route matched'}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-sm">
                <ArrowRightIcon className="size-4 text-muted-foreground" />
                {describeAction(result.winner?.action ?? fallback)}
              </div>
              {result.winner?.action.type === 'page' && <p className="mt-3 rounded-lg bg-background p-3 text-sm">{result.winner.action.content}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              {result.checks.map(({ route, hit }, i) => {
                const won = route === result.winner;
                return (
                  <div key={route.id} className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm', won ? 'border-success/40 bg-success/8' : 'opacity-80')}>
                    {hit ? <CircleCheckIcon className="size-4 text-success-foreground" /> : <CircleDashedIcon className="size-4 text-muted-foreground" />}
                    <span className="text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className={cn(won && 'font-medium')}>{route.name}</span>
                    <Badge variant={won ? 'success' : hit ? 'outline' : 'secondary'} className="ms-auto">
                      {won ? 'Routed here' : hit ? 'Also matches' : 'No match'}
                    </Badge>
                  </div>
                );
              })}
            </div>
            {result.members && (
              <div className="flex flex-col gap-2 rounded-xl border p-4">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <UsersIcon className="size-4" /> Eligible hosts
                  <Badge variant="outline" className="ms-auto">
                    {result.members.length}
                  </Badge>
                </div>
                {result.members.length === 0 && <p className="text-muted-foreground text-sm">No team member matches this route's attribute rules.</p>}
                {result.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 font-medium text-xs">{m.avatar}</span>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{m.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {m.seniority} · {m.location} · {m.skills.join(', ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}
