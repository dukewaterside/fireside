/** Trade labels for subcontractors (profiles.trade) */
export const TRADE_LABELS: Record<string, string> = {
  framing: 'Framing',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  hvac: 'HVAC',
  countertops: 'Countertops',
  flooring: 'Flooring',
  painting: 'Painting',
  windows_doors: 'Windows & Doors',
  roofing: 'Roofing',
  insulation: 'Insulation',
  drywall: 'Drywall',
  other: 'Other',
};

export const BUILDING_LABELS: Record<string, string> = {
  framing: 'Framing',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  hvac: 'HVAC',
  countertops: 'Countertops',
  flooring: 'Flooring',
  painting: 'Painting',
  windows_doors: 'Windows & Doors',
  roofing: 'Roofing',
  insulation: 'Insulation',
  drywall: 'Drywall',
  other: 'Other',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/** DB role values in profiles.role (standard_user removed) */
export const PROFILE_ROLES = [
  'owner',
  'project_manager',
  'subcontractor',
  'internal_developer',
] as const;

export type ProfileRole = (typeof PROFILE_ROLES)[number];

/** Display labels for "Assign to user" picker */
export const ROLE_TYPE_OPTIONS: { label: string; value: ProfileRole }[] = [
  { label: 'Owner', value: 'owner' },
  { label: 'Property Manager', value: 'project_manager' },
  { label: 'Subcontractor', value: 'subcontractor' },
  { label: 'Internal Developer', value: 'internal_developer' },
];
