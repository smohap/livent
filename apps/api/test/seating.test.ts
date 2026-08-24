import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateSeating, type SeatingGuest, type SeatingTableInput } from '../src/services/seating.js';

const guest = (id: string, over: Partial<SeatingGuest> = {}): SeatingGuest => ({
  id,
  name: id,
  groupId: null,
  isVip: false,
  isChild: false,
  seats: 1,
  ...over,
});

const table = (n: number, over: Partial<SeatingTableInput> = {}): SeatingTableInput => ({
  id: `t${n}`,
  number: n,
  capacity: 10,
  kind: 'standard',
  locked: false,
  occupants: [],
  ...over,
});

const tableOf = (result: ReturnType<typeof generateSeating>, guestId: string) =>
  result.assignments.find((a) => a.guestId === guestId)?.tableId;

test('seats everyone when there is ample capacity', () => {
  const guests = Array.from({ length: 40 }, (_, i) => guest(`g${i}`));
  const tables = Array.from({ length: 6 }, (_, i) => table(i + 1));

  const result = generateSeating(guests, tables, [], 1);

  assert.equal(result.unseated.length, 0);
  assert.equal(result.assignments.length, 40);
});

test('never seats an "apart" pair at the same table', () => {
  const guests = Array.from({ length: 20 }, (_, i) => guest(`g${i}`));
  const tables = Array.from({ length: 4 }, (_, i) => table(i + 1, { capacity: 5 }));

  const result = generateSeating(guests, tables, [{ kind: 'apart', guestIds: ['g0', 'g1'] }], 7);

  assert.notEqual(tableOf(result, 'g0'), undefined);
  assert.notEqual(tableOf(result, 'g0'), tableOf(result, 'g1'));
});

test('keeps a "together" cluster on one table', () => {
  const guests = Array.from({ length: 24 }, (_, i) => guest(`g${i}`));
  const tables = Array.from({ length: 4 }, (_, i) => table(i + 1, { capacity: 8 }));

  const result = generateSeating(
    guests,
    tables,
    [{ kind: 'together', guestIds: ['g1', 'g2', 'g3', 'g4'] }],
    11,
  );

  const seats = ['g1', 'g2', 'g3', 'g4'].map((id) => tableOf(result, id));
  assert.equal(new Set(seats).size, 1, 'cluster was split across tables');
  assert.equal(result.stats.clustersKeptTogether, 1);
});

test('leaves locked tables untouched and excludes their guests from the pool', () => {
  const guests = Array.from({ length: 12 }, (_, i) => guest(`g${i}`));
  const tables = [
    table(1, { capacity: 4, locked: true, occupants: ['g0', 'g1'] }),
    table(2, { capacity: 6 }),
    table(3, { capacity: 6 }),
  ];

  const result = generateSeating(guests, tables, [], 3);

  assert.equal(tableOf(result, 'g0'), undefined, 'locked guest was reassigned');
  assert.equal(
    result.assignments.some((a) => a.tableId === 't1'),
    false,
    'engine wrote into a locked table',
  );
  assert.equal(result.assignments.length, 10);
});

test('routes children to the children table and VIPs to the VIP table', () => {
  const guests = [
    ...Array.from({ length: 6 }, (_, i) => guest(`c${i}`, { isChild: true })),
    ...Array.from({ length: 4 }, (_, i) => guest(`v${i}`, { isVip: true })),
    ...Array.from({ length: 10 }, (_, i) => guest(`g${i}`)),
  ];
  const tables = [
    table(1, { kind: 'vip', capacity: 8 }),
    table(2, { kind: 'children', capacity: 8 }),
    table(3, { capacity: 10 }),
    table(4, { capacity: 10 }),
  ];

  const result = generateSeating(guests, tables, [], 5);

  for (const id of ['c0', 'c1', 'c2']) assert.equal(tableOf(result, id), 't2');
  for (const id of ['v0', 'v1']) assert.equal(tableOf(result, id), 't1');
});

test('reports guests it cannot seat instead of dropping them silently', () => {
  const guests = Array.from({ length: 12 }, (_, i) => guest(`g${i}`));
  const tables = [table(1, { capacity: 4 }), table(2, { capacity: 4 })];

  const result = generateSeating(guests, tables, [], 2);

  assert.equal(result.assignments.length, 8);
  assert.equal(result.unseated.length, 4);
  assert.match(result.unseated[0]!.reason, /capacity/i);
});

test('is deterministic for a seed and varies across seeds', () => {
  const guests = Array.from({ length: 30 }, (_, i) => guest(`g${i}`));
  const tables = Array.from({ length: 5 }, (_, i) => table(i + 1, { capacity: 8 }));

  const a = generateSeating(guests, tables, [], 99);
  const b = generateSeating(guests, tables, [], 99);
  const c = generateSeating(guests, tables, [], 100);

  assert.deepEqual(a.assignments, b.assignments);
  assert.notDeepEqual(a.assignments, c.assignments);
});
