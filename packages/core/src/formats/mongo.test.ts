import { describe, expect, it } from 'vitest';
import { decode, encode } from '../codec';
import { fields } from '../fixtures.test-helpers';
import type { Query } from '../types';
import { everyOperator, withIncomplete } from './_fixtures.test-helpers';
import { mongo } from './mongo';

describe('mongo', () => {
  it('encodes every operator', () => {
    expect(encode(mongo, everyOperator, fields)).toEqual({
      $and: [
        { name: { $eq: 'Ada' } },
        { name: { $ne: "O'Brien" } },
        { age: { $lt: 50 } },
        { age: { $lte: 50 } },
        { age: { $gt: 18 } },
        { age: { $gte: 18 } },
        { name: { $regex: '50%_off', $options: 'i' } },
        { name: { $not: { $regex: 'x', $options: 'i' } } },
        { name: { $regex: '^A', $options: 'i' } },
        { name: { $regex: 'e$', $options: 'i' } },
        { age: { $gte: 18, $lte: 65 } },
        { age: { $not: { $gte: 1, $lte: 5 } } },
        { status: { $in: ['active', 'pending'] } },
        { status: { $nin: ['banned'] } },
        { nickname: { $eq: null } },
        { nickname: { $ne: null } },
        { $expr: { $gt: ['$age', '$minAge'] } },
        { verified: { $eq: true } },
        { joined: { $gte: '2024-01-01' } },
        { $nor: [{ status: { $eq: 'banned' } }, { $and: [{ score: { $gte: 1, $lte: 10 } }] }] },
      ],
    });
  });

  it('escapes regex metacharacters and honours caseSensitive fields', () => {
    const cs = { ...fields, code: { ...fields.name, caseSensitive: true } };
    const q: Query = { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'code', operator: 'startsWith', value: 'a.b*(c)' }] };
    expect(encode(mongo, q, cs)).toEqual({ $and: [{ code: { $regex: '^a\\.b\\*\\(c\\)' } }] });
    expect(decode(mongo, encode(mongo, q, cs), cs)).toEqual(q);
  });

  it('round-trips', () => {
    expect(decode(mongo, encode(mongo, everyOperator, fields), fields)).toEqual(everyOperator);
    const notAnd: Query = { kind: 'group', combinator: 'and', not: true, children: [{ kind: 'rule', field: 'age', operator: 'gt', value: 1 }, { kind: 'rule', field: 'age', operator: 'lt', value: 9 }] };
    expect(encode(mongo, notAnd, fields)).toEqual({ $nor: [{ $and: [{ age: { $gt: 1 } }, { age: { $lt: 9 } }] }] });
    expect(decode(mongo, encode(mongo, notAnd, fields), fields)).toEqual(notAnd);
  });

  it('skips incomplete rules; empty query is {}', () => {
    expect(encode(mongo, withIncomplete, fields)).toEqual({ $and: [{ age: { $gt: 30 } }] });
    expect(encode(mongo, { kind: 'group', combinator: 'or', children: [] }, fields)).toEqual({});
    expect(decode(mongo, {}, fields)).toEqual({ kind: 'group', combinator: 'and', children: [] });
  });

  it('decodes hand-written shorthand filters', () => {
    expect(decode(mongo, { age: 21, status: { $in: ['active'] }, name: /^Ad/, nickname: null, minAge: { $gt: 1, $lt: '9' } }, fields)).toEqual({
      kind: 'group',
      combinator: 'and',
      children: [
        { kind: 'rule', field: 'age', operator: 'eq', value: 21 },
        { kind: 'rule', field: 'status', operator: 'in', value: ['active'] },
        { kind: 'rule', field: 'name', operator: 'startsWith', value: 'Ad' },
        { kind: 'rule', field: 'nickname', operator: 'isNull' },
        { kind: 'rule', field: 'minAge', operator: 'gt', value: 1 },
        { kind: 'rule', field: 'minAge', operator: 'lt', value: 9 },
      ],
    });
    expect(decode(mongo, { $or: [{ age: 1 }, { $nor: [{ name: { $not: /^x/ } }] }] }, fields)).toEqual({
      kind: 'group',
      combinator: 'or',
      children: [
        { kind: 'rule', field: 'age', operator: 'eq', value: 1 },
        // NOT NOT startsWith: the double negation cancels out.
        { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'name', operator: 'startsWith', value: 'x' }] },
      ],
    });
  });

  it('rejects filters it cannot represent', () => {
    expect(() => decode(mongo, { name: { $regex: 'a+b' } }, fields)).toThrow(/cannot decode/);
    expect(() => decode(mongo, { $where: 'x' }, fields)).toThrow(/cannot decode/);
    expect(() => decode(mongo, { age: { $exists: true } }, fields)).toThrow(/cannot decode/);
  });
});
