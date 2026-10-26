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
 * (`member-<slug>`).
 *
 * If two different people shared one old id, that old id is NOT put in `remap`
 * (ambiguous). Callers must resolve payers / exclusions by name in that case.
 * Each person still receives their own unique stable id in `members`.
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

  const usedIds = new Set<string>();
  const unique: T[] = [];
  /** oldId → list of new stable ids that came from it */
  const claims = new Map<string, string[]>();

  for (const member of byName.values()) {
    let id = stableMemberId(member.name);
    if (usedIds.has(id)) id = `${id}-${unique.length + 1}`;

    const oldId = (member.id || '').trim();
    if (oldId && oldId !== id) {
      const list = claims.get(oldId) || [];
      list.push(id);
      claims.set(oldId, list);
    }

    usedIds.add(id);
    unique.push({ ...member, id });
  }

  const remap = new Map<string, string>();
  for (const [oldId, targets] of claims.entries()) {
    // Only remap when exactly one person owned that old id.
    if (targets.length === 1) remap.set(oldId, targets[0]);
  }

  // Flatten chains and drop identity mappings.
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

/**
 * Map an exclusion / foreign id onto a member. Prefer remap, then exact id,
 * then slug match inside legacy ids like `mem-3-allen` — never invent exclusions.
 */
export function resolveMemberId(
  rawId: string | undefined,
  members: NamedMember[],
  remap: Map<string, string> = new Map(),
): string | undefined {
  if (!rawId) return undefined;
  const remapped = remap.get(rawId);
  if (remapped && members.some((m) => m.id === remapped)) return remapped;
  const exact = members.find((m) => m.id === rawId);
  if (exact) return exact.id;
  const lower = rawId.toLowerCase();
  const byStable = members.find((m) => m.id === rawId || stableMemberId(m.name) === rawId);
  if (byStable) return byStable.id;
  for (const m of members) {
    const slug = m.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) continue;
    if (lower === `member-${slug}` || lower.endsWith(`-${slug}`) || lower.includes(`-${slug}-`)) {
      return m.id;
    }
  }
  return remap.get(rawId) || rawId;
}
