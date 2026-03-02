import { describe, expect, it } from '@jest/globals';
import { compareUnitNumbers, unitSortKey } from '../unitSort';

describe('unitSortKey', () => {
  it('extracts prefix, numbers, and suffix for "Downhill 6A"', () => {
    expect(unitSortKey('Downhill 6A')).toEqual(['Downhill', 6, 0, 'A']);
  });

  it('extracts both numbers for "Downhill 6-7"', () => {
    expect(unitSortKey('Downhill 6-7')).toEqual(['Downhill', 6, 7, '']);
  });

  it('handles "Uphill 1A"', () => {
    expect(unitSortKey('Uphill 1A')).toEqual(['Uphill', 1, 0, 'A']);
  });

  it('handles "Hillside End 15B (Lower)"', () => {
    // suffix is trailing letters; "(Lower)" yields "" because ) is not a letter
    expect(unitSortKey('Hillside End 15B (Lower)')).toEqual(['Hillside End', 15, 0, '']);
  });

  it('handles "Single Family 3"', () => {
    expect(unitSortKey('Single Family 3')).toEqual(['Single Family', 3, 0, '']);
  });

  it('handles empty string', () => {
    expect(unitSortKey('')).toEqual(['', 0, 0, '']);
  });
});

describe('compareUnitNumbers', () => {
  it('orders Downhill 5A before Downhill 5B', () => {
    expect(compareUnitNumbers('Downhill 5A', 'Downhill 5B')).toBeLessThan(0);
    expect(compareUnitNumbers('Downhill 5B', 'Downhill 5A')).toBeGreaterThan(0);
  });

  it('orders Downhill 6B before Downhill 6-7', () => {
    expect(compareUnitNumbers('Downhill 6B', 'Downhill 6-7')).toBeLessThan(0);
  });

  it('orders Downhill 6-7 before Downhill 7A', () => {
    expect(compareUnitNumbers('Downhill 6-7', 'Downhill 7A')).toBeLessThan(0);
  });

  it('orders full Downhill sequence correctly', () => {
    const units = [
      'Downhill 8B',
      'Downhill 6-7',
      'Downhill 5A',
      'Downhill 7A',
      'Downhill 6A',
      'Downhill 5B',
      'Downhill 8A',
      'Downhill 6B',
      'Downhill 7B',
    ];
    const sorted = [...units].sort(compareUnitNumbers);
    expect(sorted).toEqual([
      'Downhill 5A',
      'Downhill 5B',
      'Downhill 6A',
      'Downhill 6B',
      'Downhill 6-7',
      'Downhill 7A',
      'Downhill 7B',
      'Downhill 8A',
      'Downhill 8B',
    ]);
  });

  it('groups by prefix (alphabetical: Downhill before Uphill)', () => {
    expect(compareUnitNumbers('Downhill 5A', 'Uphill 1A')).toBeLessThan(0);
    expect(compareUnitNumbers('Uphill 1A', 'Downhill 5A')).toBeGreaterThan(0);
  });

  it('orders different prefixes alphabetically', () => {
    const units = ['Downhill 5A', 'Uphill 1A', 'Slopeside 4A', 'Hillside End 15A'];
    const sorted = [...units].sort(compareUnitNumbers);
    expect(sorted[0]).toBe('Downhill 5A');
    expect(sorted[1]).toBe('Hillside End 15A');
    expect(sorted[2]).toBe('Slopeside 4A');
    expect(sorted[3]).toBe('Uphill 1A');
  });

  it('returns 0 for identical unit numbers', () => {
    expect(compareUnitNumbers('Downhill 6A', 'Downhill 6A')).toBe(0);
  });
});
