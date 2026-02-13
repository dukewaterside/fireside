/** Trade labels for subcontractors (profiles.trade) */
export const TRADE_LABELS: Record<string, string> = {
  excavation: 'Excavation',
  foundation: 'Foundation',
  foundation_sealing: 'Foundation Sealing',
  framing: 'Framing',
  siding: 'Siding',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  hvac: 'HVAC',
  av: 'AV',
  blueboard_plaster: 'Blueboard / Plaster',
  garage_doors: 'Garage Doors',
  tile: 'Tile',
  masonry: 'Masonry',
  finish_carpentry: 'Finish Carpentry',
  hardwood_flooring: 'Hardwood Flooring',
  cabinets: 'Cabinets',
  countertops: 'Countertops',
  shower_glass_doors: 'Shower Glass Doors',
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
  'designer',
] as const;

export type ProfileRole = (typeof PROFILE_ROLES)[number];

/** Display labels for "Assign to user" picker */
export const ROLE_TYPE_OPTIONS: { label: string; value: ProfileRole }[] = [
  { label: 'Owner', value: 'owner' },
  { label: 'Property Manager', value: 'project_manager' },
  { label: 'Subcontractor', value: 'subcontractor' },
  { label: 'Designer', value: 'designer' },
];
