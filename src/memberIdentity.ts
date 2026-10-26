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

/**
 * Keep one record per name. Prefer the stable id when one of the copies already has it.
 * `remap` sends every dropped id to the id that is kept.
 */
export function collapseMembers<T extends NamedMember>(members: T[]): {
  members: T[];
  remap: Map<string, string>;
} {
  const byName = new Map<string, T>();
  const remap = new Map<string, string>();

  for (const member of members) {
    const key = member.name.trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, member);
      continue;
    }
    const keepNew = member.id.startsWith('member-') && !existing.id.startsWith('member-');
    const keeper = keepNew ? member : existing;
    const dropped = keepNew ? existing : member;
    byName.set(key, keeper);
    if (dropped.id !== keeper.id) remap.set(dropped.id, keeper.id);
  }

  // Different names must never share one id (hosted sync sometimes reuses a payer id).
  const usedIds = new Set<string>();
  const unique: T[] = [];
  for (const member of byName.values()) {
    let next = member;
    if (!next.id || usedIds.has(next.id)) {
      // Keep the first owner of the shared id; give this traveller a fresh stable id.
      // Do not remap the shared id — it still belongs to the earlier keeper (e.g. Sanket).
      let id = stableMemberId(next.name);
      if (!id || usedIds.has(id)) id = `${stableMemberId(next.name)}-${unique.length + 1}`;
      next = { ...member, id };
    }
    usedIds.add(next.id);
    unique.push(next);
  }

  const keeperIds = new Set(unique.map((member) => member.id));
  for (const [from, to] of [...remap.entries()]) {
    let cursor = to;
    const seen = new Set<string>();
    while (remap.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      cursor = remap.get(cursor)!;
    }
    remap.set(from, keeperIds.has(cursor) ? cursor : to);
  }

  return { members: unique, remap };
}

export function remapId(id: string | undefined, remap: Map<string, string>): string | undefined {
  if (!id) return id;
  return remap.get(id) || id;
}
