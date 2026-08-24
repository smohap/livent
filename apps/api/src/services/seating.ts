/**
 * Evyent seating engine (PRD section 6.4).
 *
 * Takes confirmed guests, table geometry and organiser rules, and produces a
 * table allocation in one pass. Design goals, in priority order:
 *
 *   1. Never violate a hard "must not sit together" rule.
 *   2. Keep "must sit together" clusters intact on one table.
 *   3. Respect table kind affinities (VIPs to VIP tables, children to
 *      children tables).
 *   4. Keep guest groups (bride's family, work colleagues) contiguous.
 *   5. Fill tables evenly rather than packing the first tables full.
 *
 * Locked tables are immovable: their occupants are excluded from the pool and
 * their remaining capacity is not offered to anyone else.
 *
 * The engine is deterministic for a given seed, so "Regenerate" produces a
 * genuinely different-but-valid arrangement rather than random churn.
 */

export interface SeatingGuest {
  id: string;
  name: string;
  groupId: string | null;
  isVip: boolean;
  isChild: boolean;
  /** Confirmed heads this guest occupies (guest + plus-ones/children). */
  seats: number;
}

export interface SeatingTableInput {
  id: string;
  number: number;
  capacity: number;
  kind: string;
  locked: boolean;
  /** Guest ids already seated here. Only meaningful when `locked` is true. */
  occupants: string[];
}

export interface SeatingRuleInput {
  kind: string;
  guestIds: string[];
}

export interface SeatingResult {
  assignments: Array<{ tableId: string; guestId: string; seatNo: number }>;
  unseated: Array<{ guestId: string; name: string; reason: string }>;
  stats: {
    tablesUsed: number;
    seatsUsed: number;
    seatsAvailable: number;
    clustersKeptTogether: number;
    clustersSplit: number;
  };
}

/** Deterministic 32-bit PRNG so a seed reproduces an arrangement exactly. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = copy[i]!;
    const b = copy[j]!;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}

class UnionFind {
  private parent = new Map<string, string>();

  find(id: string): string {
    const seen = this.parent.get(id);
    if (seen === undefined) {
      this.parent.set(id, id);
      return id;
    }
    if (seen === id) return id;
    const root = this.find(seen);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
}

interface Cluster {
  guests: SeatingGuest[];
  seats: number;
  vip: boolean;
  children: boolean;
  /** Dominant guest group, used for soft "keep the family near" packing. */
  groupId: string | null;
}

interface WorkingTable {
  input: SeatingTableInput;
  remaining: number;
  seated: string[];
  groups: Map<string, number>;
}

export function generateSeating(
  guests: SeatingGuest[],
  tables: SeatingTableInput[],
  rules: SeatingRuleInput[],
  seed = Date.now(),
): SeatingResult {
  const rand = mulberry32(seed);
  const byId = new Map(guests.map((g) => [g.id, g]));

  // --- Hard "apart" pairs -------------------------------------------------
  const apart = new Map<string, Set<string>>();
  const addApart = (a: string, b: string) => {
    if (!apart.has(a)) apart.set(a, new Set());
    if (!apart.has(b)) apart.set(b, new Set());
    apart.get(a)!.add(b);
    apart.get(b)!.add(a);
  };
  for (const rule of rules) {
    if (rule.kind !== 'apart') continue;
    for (let i = 0; i < rule.guestIds.length; i++) {
      for (let j = i + 1; j < rule.guestIds.length; j++) {
        addApart(rule.guestIds[i]!, rule.guestIds[j]!);
      }
    }
  }

  // --- Cluster "together" guests -----------------------------------------
  const uf = new UnionFind();
  for (const guest of guests) uf.find(guest.id);
  for (const rule of rules) {
    if (rule.kind !== 'together') continue;
    const members = rule.guestIds.filter((id) => byId.has(id));
    for (let i = 1; i < members.length; i++) uf.union(members[0]!, members[i]!);
  }

  const vipFlagged = new Set<string>(
    rules.filter((r) => r.kind === 'vip').flatMap((r) => r.guestIds),
  );
  const childFlagged = new Set<string>(
    rules.filter((r) => r.kind === 'children').flatMap((r) => r.guestIds),
  );

  // Locked tables keep whoever is already seated on them.
  const lockedGuestIds = new Set<string>(
    tables.filter((t) => t.locked).flatMap((t) => t.occupants),
  );

  const clusterMap = new Map<string, Cluster>();
  for (const guest of guests) {
    if (lockedGuestIds.has(guest.id)) continue;
    const root = uf.find(guest.id);
    let cluster = clusterMap.get(root);
    if (!cluster) {
      cluster = { guests: [], seats: 0, vip: false, children: false, groupId: guest.groupId };
      clusterMap.set(root, cluster);
    }
    cluster.guests.push(guest);
    cluster.seats += Math.max(1, guest.seats);
    cluster.vip = cluster.vip || guest.isVip || vipFlagged.has(guest.id);
    cluster.children = cluster.children || guest.isChild || childFlagged.has(guest.id);
    if (cluster.groupId !== guest.groupId) cluster.groupId = null;
  }

  const working: WorkingTable[] = tables.map((table) => {
    if (!table.locked) {
      return { input: table, remaining: table.capacity, seated: [], groups: new Map() };
    }
    const groups = new Map<string, number>();
    for (const id of table.occupants) {
      const g = byId.get(id);
      if (g?.groupId) groups.set(g.groupId, (groups.get(g.groupId) ?? 0) + 1);
    }
    return { input: table, remaining: 0, seated: [...table.occupants], groups };
  });

  const violatesApart = (table: WorkingTable, cluster: Cluster): boolean =>
    cluster.guests.some((guest) => {
      const enemies = apart.get(guest.id);
      if (!enemies) return false;
      return table.seated.some((seatedId) => enemies.has(seatedId));
    });

  /** Higher is better. Encodes goals 3-5 as a single score. */
  const score = (table: WorkingTable, cluster: Cluster): number => {
    let value = 0;
    const kind = table.input.kind;

    if (cluster.children) value += kind === 'children' ? 60 : kind === 'vip' ? -40 : 0;
    else if (kind === 'children') value -= 45;

    if (cluster.vip) value += kind === 'vip' || kind === 'head' ? 60 : -25;
    else if (kind === 'vip' || kind === 'head') value -= 35;

    if (cluster.groupId) value += (table.groups.get(cluster.groupId) ?? 0) * 6;

    // Prefer emptier tables so the room fills evenly, but reward a snug fit.
    const after = table.remaining - cluster.seats;
    value += table.remaining * 1.5;
    if (after === 0) value += 12;

    return value + rand() * 4;
  };

  const pickBest = (options: WorkingTable[], cluster: Cluster): WorkingTable => {
    let best = options[0]!;
    let bestScore = score(best, cluster);
    for (const table of options.slice(1)) {
      const s = score(table, cluster);
      if (s > bestScore) {
        best = table;
        bestScore = s;
      }
    }
    return best;
  };

  const assignments: SeatingResult['assignments'] = [];
  const unseated: SeatingResult['unseated'] = [];
  let clustersKeptTogether = 0;
  let clustersSplit = 0;

  const seatOnto = (table: WorkingTable, members: SeatingGuest[]) => {
    for (const guest of members) {
      const seatNo = table.input.capacity - table.remaining + 1;
      assignments.push({ tableId: table.input.id, guestId: guest.id, seatNo });
      table.seated.push(guest.id);
      table.remaining -= Math.max(1, guest.seats);
      if (guest.groupId) table.groups.set(guest.groupId, (table.groups.get(guest.groupId) ?? 0) + 1);
    }
  };

  const clusters = [...clusterMap.values()].sort((a, b) => b.seats - a.seats);

  for (const cluster of clusters) {
    const candidates = shuffle(working, rand).filter(
      (t) => t.remaining >= cluster.seats && !violatesApart(t, cluster),
    );

    if (candidates.length > 0) {
      seatOnto(pickBest(candidates, cluster), cluster.guests);
      if (cluster.guests.length > 1) clustersKeptTogether++;
      continue;
    }

    // No single table fits the whole cluster. Split it guest-by-guest rather
    // than leaving the party unseated, and report that we had to.
    if (cluster.guests.length > 1) clustersSplit++;
    for (const guest of cluster.guests) {
      const solo: Cluster = {
        guests: [guest],
        seats: Math.max(1, guest.seats),
        vip: guest.isVip || vipFlagged.has(guest.id),
        children: guest.isChild || childFlagged.has(guest.id),
        groupId: guest.groupId,
      };
      const options = shuffle(working, rand).filter(
        (t) => t.remaining >= solo.seats && !violatesApart(t, solo),
      );
      if (options.length === 0) {
        const capacityLeft = working.some((t) => t.remaining >= solo.seats);
        unseated.push({
          guestId: guest.id,
          name: guest.name,
          reason: capacityLeft
            ? 'Every table with space holds someone this guest must not sit with'
            : 'No table has enough remaining capacity',
        });
        continue;
      }
      seatOnto(pickBest(options, solo), [guest]);
    }
  }

  return {
    assignments,
    unseated,
    stats: {
      tablesUsed: working.filter((t) => t.seated.length > 0).length,
      seatsUsed: working.reduce((sum, t) => sum + t.seated.length, 0),
      seatsAvailable: tables.reduce((sum, t) => sum + t.capacity, 0),
      clustersKeptTogether,
      clustersSplit,
    },
  };
}
