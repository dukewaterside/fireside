import { describe, expect, it } from '@jest/globals';
import {
  BUILDING_LABELS,
  PRIORITY_LABELS,
  PROFILE_ROLES,
  ROLE_TYPE_OPTIONS,
  TRADE_LABELS,
} from '../tickets';

describe('TRADE_LABELS', () => {
  it('has expected trade keys with display labels', () => {
    const expected = [
      'av',
      'blueboard_plaster',
      'cabinets',
      'countertops',
      'drywall',
      'electrical',
      'excavation',
      'finish_carpentry',
      'flooring',
      'foundation',
      'foundation_sealing',
      'framing',
      'garage_doors',
      'hardwood_flooring',
      'hvac',
      'insulation',
      'masonry',
      'other',
      'painting',
      'plumbing',
      'roofing',
      'shower_glass_doors',
      'siding',
      'tile',
      'windows_doors',
    ];
    expect(Object.keys(TRADE_LABELS).sort()).toEqual(expected);
    expect(TRADE_LABELS.framing).toBe('Framing');
    expect(TRADE_LABELS.hvac).toBe('HVAC');
    expect(TRADE_LABELS.windows_doors).toBe('Windows & Doors');
    expect(TRADE_LABELS.other).toBe('Other');
  });

  it('has a label for every key', () => {
    for (const key of Object.keys(TRADE_LABELS)) {
      expect(TRADE_LABELS[key]).toBeDefined();
      expect(typeof TRADE_LABELS[key]).toBe('string');
      expect(TRADE_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});

describe('BUILDING_LABELS', () => {
  it('has same keys as TRADE_LABELS', () => {
    expect(Object.keys(BUILDING_LABELS).sort()).toEqual(Object.keys(TRADE_LABELS).sort());
  });
});

describe('PRIORITY_LABELS', () => {
  it('has low, medium, high', () => {
    expect(PRIORITY_LABELS.low).toBe('Low');
    expect(PRIORITY_LABELS.medium).toBe('Medium');
    expect(PRIORITY_LABELS.high).toBe('High');
    expect(Object.keys(PRIORITY_LABELS).sort()).toEqual(['high', 'low', 'medium']);
  });
});

describe('PROFILE_ROLES', () => {
  it('contains expected role values', () => {
    expect(PROFILE_ROLES).toContain('owner');
    expect(PROFILE_ROLES).toContain('project_manager');
    expect(PROFILE_ROLES).toContain('subcontractor');
    expect(PROFILE_ROLES).toContain('designer');
    expect(PROFILE_ROLES).toContain('developer');
    expect(PROFILE_ROLES).toHaveLength(5);
  });
});

describe('ROLE_TYPE_OPTIONS', () => {
  it('has one option per profile role with label and value', () => {
    expect(ROLE_TYPE_OPTIONS).toHaveLength(5);
    const values = ROLE_TYPE_OPTIONS.map((o) => o.value);
    expect(values).toEqual([...PROFILE_ROLES]);
    for (const opt of ROLE_TYPE_OPTIONS) {
      expect(opt.label).toBeDefined();
      expect(typeof opt.label).toBe('string');
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });

  it('Property Manager maps to project_manager', () => {
    const pm = ROLE_TYPE_OPTIONS.find((o) => o.value === 'project_manager');
    expect(pm).toBeDefined();
    expect(pm!.label).toBe('Property Manager');
  });

  it('Designer maps to designer', () => {
    const designer = ROLE_TYPE_OPTIONS.find((o) => o.value === 'designer');
    expect(designer).toBeDefined();
    expect(designer!.label).toBe('Designer');
  });

  it('Developer maps to developer', () => {
    const developer = ROLE_TYPE_OPTIONS.find((o) => o.value === 'developer');
    expect(developer).toBeDefined();
    expect(developer!.label).toBe('Developer');
  });
});
