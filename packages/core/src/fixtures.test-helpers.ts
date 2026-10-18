import { defineFields, f } from './fields';

export const fields = defineFields({
  name: f.text(),
  nickname: f.text({ required: false }),
  age: f.number({ min: 0, max: 150, integer: true }),
  minAge: f.number(),
  status: f.enum(['active', 'pending', 'banned']),
  verified: f.boolean(),
  joined: f.date(),
  score: f.number({ operators: ['eq', 'gt', 'between'] }),
});
