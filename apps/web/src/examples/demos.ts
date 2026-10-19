// The live demos, keyed by slug. Each is a client component; a page renders only its own.
import type { ComponentType } from 'react';
import { Demo as AccessPolicy } from '@/components/qnot/examples/access-policy';
import { Demo as Alerting } from '@/components/qnot/examples/alerting';
import { Demo as FeatureFlags } from '@/components/qnot/examples/feature-flags';
import { Demo as LinearFilters } from '@/components/qnot/examples/linear-filters';
import { Demo as ProductFilters } from '@/components/qnot/examples/product-filters';
import { Demo as RqbDropin } from '@/components/qnot/examples/rqb-dropin';
import { Demo as SavedViews } from '@/components/qnot/examples/saved-views';
import { Demo as Segments } from '@/components/qnot/examples/segments';
import { Demo as ServerSide } from '@/components/qnot/examples/server-side';
import { Demo as Workflow } from '@/components/qnot/examples/workflow';

export const DEMOS: Record<string, ComponentType> = {
  'linear-filters': LinearFilters,
  workflow: Workflow,
  'saved-views': SavedViews,
  'product-filters': ProductFilters,
  segments: Segments,
  'feature-flags': FeatureFlags,
  alerting: Alerting,
  'access-policy': AccessPolicy,
  'rqb-dropin': RqbDropin,
  'server-side': ServerSide,
};
