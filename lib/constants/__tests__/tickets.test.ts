/**
 * Tickets constants tests. Lock expected keys and shape so refactors don't break the app.
 */

import { describe, expect, it } from '@jest/globals';
import {
  BUILDING_LABELS,
  PRIORITY_LABELS,
  PROFILE_ROLES,
  ROLE_TYPE_OPTIONS,
  TRADE_LABELS,
  type ProfileRole,
} from '../tickets';

describe('TRADE_LABELS', () => {
  it('has expected trade keys', () => {
    const keys = ['framing', 'electrical', 'plumbing', 'hvac', 'countertops', 'flooring', 'painting', 'windows_doors', 'roofing', 'insulation', 'drywall', 'other'];
    keys.forEach((k) => {
      expect(TRADE_LABELS).toHaveProperty(k);
      expect(typeof TRADE_LABELS[k]).toBe('string');
    });
  });
});

describe('PRIORITY_LABELS', () => {
  it('has low, medium, high', () => {
    expect(PRIORITY_LABELS.low).toBe('Low');
    expect(PRIORITY_LABELS.medium).toBe('Medium');
    expect(PRIORITY_LABELS.high).toBe('High');
  });
});

describe('PROFILE_ROLES', () => {
  it('contains expected roles', () => {
    expect(PROFILE_ROLES).toContain('owner');
    expect(PROFILE_ROLES).toContain('project_manager');
    expect(PROFILE_ROLES).toContain('subcontractor');
    expect(PROFILE_ROLES).toContain('internal_developer');
    expect(PROFILE_ROLES).toHaveLength(4);
  });
});

describe('ROLE_TYPE_OPTIONS', () => {
  it('has label and value for each profile role', () => {
    const values = PROFILE_ROLES as readonly ProfileRole[];
    expect(ROLE_TYPE_OPTIONS).toHaveLength(values.length);
    ROLE_TYPE_OPTIONS.forEach((opt) => {
      expect(opt).toHaveProperty('label');
      expect(opt).toHaveProperty('value');
      expect(values).toContain(opt.value);
    });
  });
});

describe('BUILDING_LABELS', () => {
  it('has same keys as TRADE_LABELS', () => {
    expect(Object.keys(BUILDING_LABELS).sort()).toEqual(Object.keys(TRADE_LABELS).sort());
  });
});
