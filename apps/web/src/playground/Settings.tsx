'use client';
import type { StoreSettings } from '@trawlnet/core';
import { RotateCcwIcon, SettingsIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ScrollBox } from '@/components/trawlnet/scroll-box';
import { Button } from '@/components/ui/button';
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field';
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

/** Store settings plus the UI-only toggles the builders take as props. */
export interface PlaygroundSettings {
  readOnly: boolean;
  immutableGroups: boolean;
  immutableFields: boolean;
  immutableOperators: boolean;
  immutableValues: boolean;
  maxRules: number | null;
  maxDepth: number | null;
  canReorder: boolean;
  canRegroup: boolean;
  canLeaveEmptyGroup: boolean;
  emptyNewGroups: boolean;
  canDeleteLocked: boolean;
  allowRefs: boolean;
  allowFunctions: boolean;
  showNot: boolean;
  showLock: boolean;
  confirmRemove: boolean;
}

export const DEFAULT_SETTINGS: PlaygroundSettings = {
  readOnly: false,
  immutableGroups: false,
  immutableFields: false,
  immutableOperators: false,
  immutableValues: false,
  maxRules: null,
  maxDepth: null,
  canReorder: true,
  canRegroup: true,
  canLeaveEmptyGroup: true,
  emptyNewGroups: false,
  canDeleteLocked: false,
  allowRefs: true,
  allowFunctions: true,
  showNot: true,
  showLock: true,
  confirmRemove: false,
};

/** Translate playground settings to the store's (confirmRemove is wired by the caller). */
export function toStoreSettings(s: PlaygroundSettings): StoreSettings {
  return {
    readOnly: s.readOnly,
    immutable: { groups: s.immutableGroups, fields: s.immutableFields, operators: s.immutableOperators, values: s.immutableValues },
    maxRules: s.maxRules ?? undefined,
    maxDepth: s.maxDepth ?? undefined,
    canReorder: s.canReorder,
    canRegroup: s.canRegroup,
    canLeaveEmptyGroup: s.canLeaveEmptyGroup,
    emptyNewGroups: s.emptyNewGroups,
    canDeleteLocked: s.canDeleteLocked,
    allowRefs: s.allowRefs,
    allowFunctions: s.allowFunctions,
  };
}

type BoolKey = { [K in keyof PlaygroundSettings]: PlaygroundSettings[K] extends boolean ? K : never }[keyof PlaygroundSettings];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">{title}</div>
      {children}
    </div>
  );
}

export function SettingsPopover({ value, onChange }: { value: PlaygroundSettings; onChange: (s: PlaygroundSettings) => void }) {
  const toggle = (key: BoolKey, label: string, hint: string, raqb?: string) => (
    <label className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1 hover:bg-muted/50" data-setting={key}>
      <span className="flex flex-1 flex-col">
        <span className="text-sm">{label}</span>
        <span className="text-muted-foreground text-xs">
          {hint}
          {raqb && <code className="ms-1 rounded bg-muted px-1 font-mono text-[10px]">{raqb}</code>}
        </span>
      </span>
      <Switch checked={value[key]} onCheckedChange={(on) => onChange({ ...value, [key]: on })} />
    </label>
  );
  const limit = (key: 'maxRules' | 'maxDepth', label: string, hint: string) => (
    <div className="flex items-center gap-3 px-1 py-1" data-setting={key}>
      <span className="flex flex-1 flex-col">
        <span className="text-sm">{label}</span>
        <span className="text-muted-foreground text-xs">{hint}</span>
      </span>
      <NumberField size="sm" className="w-28" min={0} value={value[key]} onValueChange={(v) => onChange({ ...value, [key]: v })}>
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput placeholder="∞" aria-label={label} />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
    </div>
  );
  const changed = (Object.keys(DEFAULT_SETTINGS) as (keyof PlaygroundSettings)[]).filter((k) => value[k] !== DEFAULT_SETTINGS[k]).length;
  return (
    <Popover>
      <PopoverTrigger render={<Button size="sm" variant="outline" data-settings-trigger />}>
        <SettingsIcon /> Settings
        {changed > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground tabular-nums">{changed}</span>}
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-[min(92vw,640px)]">
        <div className="mb-2 flex items-center gap-2">
          <div>
            <div className="font-semibold text-sm">Builder settings</div>
            <div className="text-muted-foreground text-xs">Applied live with store.setSettings(); every renderer respects them.</div>
          </div>
          <Button size="xs" variant="ghost" className="ms-auto" disabled={!changed} onClick={() => onChange(DEFAULT_SETTINGS)}>
            <RotateCcwIcon /> Reset
          </Button>
        </div>
        <ScrollBox viewportClassName="max-h-[70vh]">
        <div className="grid gap-x-6 gap-y-3 pe-1 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Section title="Editing">
              {toggle('readOnly', 'Read-only', 'Nothing can be edited', 'immutable*Mode')}
              {toggle('immutableGroups', 'Lock structure', 'No adding, removing or moving', 'immutableGroupsMode')}
              {toggle('immutableFields', 'Lock fields', 'Fields fixed, values editable', 'immutableFieldsMode')}
              {toggle('immutableOperators', 'Lock operators', 'Operators fixed', 'immutableOpsMode')}
              {toggle('immutableValues', 'Lock values', 'Values fixed', 'immutableValuesMode')}
            </Section>
            <Section title="Limits">
              {limit('maxRules', 'Max rules', 'Across the whole query')}
              {limit('maxDepth', 'Max depth', 'Nested groups below the root')}
            </Section>
          </div>
          <div className="flex flex-col gap-3">
            <Section title="Structure">
              {toggle('canReorder', 'Reorder', 'Drag within a group', 'canReorder')}
              {toggle('canRegroup', 'Regroup', 'Drag between groups', 'canRegroup')}
              {toggle('canLeaveEmptyGroup', 'Keep empty groups', 'Else removing the last child removes the group', 'canLeaveEmptyGroup')}
              {toggle('emptyNewGroups', 'Empty new groups', 'Else new groups start with a rule', 'shouldCreateEmptyGroup')}
              {toggle('canDeleteLocked', 'Delete locked', 'Allow removing locked nodes', 'canDeleteLocked')}
            </Section>
            <Section title="Values & UI">
              {toggle('allowRefs', 'Field comparisons', 'Compare with another field', 'canCompareFieldWithField')}
              {toggle('allowFunctions', 'Functions', 'lowercase(), relativeDate(), …', 'valueSources: func')}
              {toggle('showNot', 'Show NOT', 'Negate groups', 'showNot')}
              {toggle('showLock', 'Show locks', 'Lock toggles on rules and groups', 'showLock')}
              {toggle('confirmRemove', 'Confirm removal', 'Ask before deleting', 'renderConfirm')}
            </Section>
          </div>
        </div>
        </ScrollBox>
      </PopoverPopup>
    </Popover>
  );
}
