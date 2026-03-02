/**
 * Sort key for unit_number so "Downhill 6-7" groups with other Downhills
 * and orders correctly (e.g. after 6B, before 7A).
 */
export function unitSortKey(unit_number: string): (string | number)[] {
  const prefixMatch = unit_number.match(/^([A-Za-z\s]+)/);
  const prefix = (prefixMatch?.[1] ?? '').trim();
  const rest = unit_number.slice(prefix.length).trim();
  const numParts: number[] = [];
  const numRe = /\d+/g;
  let m;
  while ((m = numRe.exec(rest)) != null) numParts.push(parseInt(m[0], 10));
  const letterMatch = rest.match(/([A-Za-z]+)$/);
  const suffix = letterMatch?.[1] ?? '';
  return [prefix, numParts[0] ?? 0, numParts[1] ?? 0, suffix];
}

/**
 * Compare two unit_number strings for sort order.
 * Groups by prefix (Downhill, Uphill, etc.), then by numbers, then by suffix.
 */
export function compareUnitNumbers(a: string, b: string): number {
  const ka = unitSortKey(a);
  const kb = unitSortKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const va = ka[i] ?? '';
    const vb = kb[i] ?? '';
    if (typeof va === 'number' && typeof vb === 'number') {
      if (va !== vb) return va - vb;
    } else {
      const s = String(va).localeCompare(String(vb));
      if (s !== 0) return s;
    }
  }
  return 0;
}
