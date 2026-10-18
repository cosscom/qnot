import type { ComponentType } from 'react';
import type { ExampleMeta } from './frame';
import * as routingForms from './routing-forms';

export interface ExampleModule {
  meta: ExampleMeta;
  Demo: ComponentType;
}

export const EXAMPLES: ExampleModule[] = [routingForms];
