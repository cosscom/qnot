// Shared between client and server: one schema, one source of truth for types and validation.
import { builtinFunctions, defineFields, f } from '../../packages/core/src/index';

export const fields = defineFields(
  {
    name: f.text(),
    age: f.number({ min: 0, integer: true }),
    plan: f.enum(['free', 'pro', 'team']),
    signedUp: f.date(),
  },
  { functions: builtinFunctions },
);
