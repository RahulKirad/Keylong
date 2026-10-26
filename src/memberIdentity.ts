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

  const usedIds = new Set<string>();
  const unique: T[] = [];
  const oldIdOwners = new Map<string, T[]>();

  for (const member of byName.values()) {
    const oldId = (member.id || '').trim();
    if (oldId) oldIdOwners.set(oldId, [...(oldIdOwners.get(oldId) || []), member]);
  }

  for (const member of byName.values()) {
    let id = stableMemberId(member.name);
    if (usedIds.has(id)) {
      let suffix = 2;
      while (usedIds.has(`${id}-${suffix}`)) suffix += 1;
      id = `${id}-${suffix}`;
    }
    usedIds.add(id);
    unique.push({ ...member, id });
  }

  // Only remap an old id when it belonged to one person. Ambiguous ids must be
  // resolved from the record's display name instead of assigning both people to one traveller.
  const remap = new Map<string, string>();
  for (const [oldId, owners] of oldIdOwners) {
    if (owners.length !== 1) continue;
    const owner = owners[0];
    const repaired = unique.find((member) => samePersonName(member.name, owner.name));
    if (repaired && oldId !== repaired.id) remap.set(oldId, repaired.id);
  }

  return { members: unique, remap };
}

export function remapId(id: string | undefined, remap: Map<string, string>): string | undefined {
  if (!id) return id;
  return remap.get(id) || id;
}
