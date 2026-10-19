// The live demos, keyed by slug. Each is a client component; a page renders only its own.
import type { ComponentType } from 'react';
import { Demo as AccessPolicy } from '@/components/trawlnet/examples/access-policy';
import { Demo as Alerting } from '@/components/trawlnet/examples/alerting';
import { Demo as FeatureFlags } from '@/components/trawlnet/examples/feature-flags';
import { Demo as LinearFilters } from '@/components/trawlnet/examples/linear-filters';
import { Demo as ProductFilters } from '@/components/trawlnet/examples/product-filters';
import { Demo as RqbDropin } from '@/components/trawlnet/examples/rqb-dropin';
import { Demo as SavedViews } from '@/components/trawlnet/examples/saved-views';
import { Demo as Segments } from '@/components/trawlnet/examples/segments';
import { Demo as ServerSide } from '@/components/trawlnet/examples/server-side';
import { Demo as Workflow } from '@/components/trawlnet/examples/workflow';

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
