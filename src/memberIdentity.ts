export type NamedMember = { id: string; name: string };

/** Same id on every browser, so opening the site again does not create another Rahul. */
export function stableMemberId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `member-${slug || 'traveller'}`;
}

export function samePersonName(a: string | undefined, b: string | undefined): boolean {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

/**
 * Keep one record per name, then force every person onto a unique stable id
 * (`member-<slug>`). Hosted data sometimes reuses one id for two travellers
 * (e.g. Rahul + Sanket both share Sanket’s id) which drops someone from Splitwise.
 *
 * `remap` maps old ids → the keeper’s stable id. If two people shared one old id,
 * the first person processed claims that remap; the second still gets their own
 * new stable id (payer / splits resolve by name as a safety net).
 */
export function collapseMembers<T extends NamedMember>(members: T[]): {
  members: T[];
  remap: Map<string, string>;
} {
  const byName = new Map<string, T>();

  for (const member of members) {
    const key = member.name.trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, member);
      continue;
    }
    const stable = stableMemberId(member.name);
    const keepNew =
      (member.id === stable && existing.id !== stable) ||
      (member.id.startsWith('member-') && !existing.id.startsWith('member-'));
    byName.set(key, keepNew ? member : existing);
  }

  const remap = new Map<string, string>();
  const usedIds = new Set<string>();
  const unique: T[] = [];

  for (const member of byName.values()) {
    let id = stableMemberId(member.name);
    if (usedIds.has(id)) id = `${id}-${unique.length + 1}`;

    const oldId = (member.id || '').trim();
    if (oldId && oldId !== id && !remap.has(oldId)) {
      // First claimant of a duplicated old id wins the remap entry.
      remap.set(oldId, id);
    }

    usedIds.add(id);
    unique.push({ ...member, id });
  }

  // Flatten remap chains and drop identity mappings.
  for (const [from, to] of [...remap.entries()]) {
    let cursor = to;
    const seen = new Set<string>();
    while (remap.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      cursor = remap.get(cursor)!;
    }
    const keeperIds = new Set(unique.map((m) => m.id));
    const resolved = keeperIds.has(cursor) ? cursor : to;
    if (from === resolved) remap.delete(from);
    else remap.set(from, resolved);
  }

  return { members: unique, remap };
}

export function remapId(id: string | undefined, remap: Map<string, string>): string | undefined {
  if (!id) return id;
  return remap.get(id) || id;
}
