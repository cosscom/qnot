// The live demos, keyed by slug. Each is a client component; a page renders only its own.
import type { ComponentType } from 'react';
import { Demo as AccessPolicy } from './access-policy';
import { Demo as Alerting } from './alerting';
import { Demo as FeatureFlags } from './feature-flags';
import { Demo as LinearFilters } from './linear-filters';
import { Demo as ProductFilters } from './product-filters';
import { Demo as RqbDropin } from './rqb-dropin';
import { Demo as SavedViews } from './saved-views';
import { Demo as Segments } from './segments';
import { Demo as ServerSide } from './server-side';
import { Demo as Workflow } from './workflow';

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
