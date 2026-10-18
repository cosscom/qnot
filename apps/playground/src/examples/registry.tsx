import type { ComponentType } from 'react';
import * as accessPolicy from './access-policy';
import * as alerting from './alerting';
import * as featureFlags from './feature-flags';
import type { ExampleMeta } from './frame';
import * as linearFilters from './linear-filters';
import * as productFilters from './product-filters';
import * as routingForms from './routing-forms';
import * as rqbDropin from './rqb-dropin';
import * as savedViews from './saved-views';
import * as segments from './segments';
import * as serverSide from './server-side';
import * as workflow from './workflow';

export interface ExampleModule {
  meta: ExampleMeta;
  Demo: ComponentType;
}

export const EXAMPLES: ExampleModule[] = [
  routingForms,
  linearFilters,
  workflow,
  savedViews,
  productFilters,
  segments,
  featureFlags,
  alerting,
  accessPolicy,
  rqbDropin,
  serverSide,
];
