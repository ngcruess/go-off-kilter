export interface Hole {
  id: number;
  x: number;
  y: number;
}

export interface PlacementFull {
  id: number;
  layout_id: number;
  hole_id: number;
  set_id: number;
  x: number;
  y: number;
}

export interface PlacementRole {
  id: number;
  name: string;
  led_color: string;
}

export interface LED {
  id: number;
  hole_id: number;
  position: number;
}

export interface DifficultyGrade {
  difficulty: number;
  boulder_name: string;
  route_name: string;
  is_listed: boolean;
}

export interface BoardLayout {
  holes: Hole[];
  placements: PlacementFull[];
  roles: PlacementRole[];
  leds: LED[];
}

export interface ClimbPlacement {
  placement_id: number;
  role_id: number;
}

export interface ClimbSummary {
  uuid: string;
  name: string;
  setter_username?: string;
  is_draft: boolean;
  angle?: number;
  display_difficulty?: number;
  grade?: string;
  quality_average?: number;
  ascensionist_count?: number;
  is_no_match?: boolean;
}

export interface ClimbDetail {
  uuid: string;
  layout_id: number;
  setter_id?: number;
  setter_username?: string;
  name: string;
  description?: string;
  frames: string;
  is_draft: boolean;
  is_listed: boolean;
  is_no_match?: boolean;
  created_at: string;
  set_angle?: number;
  stats?: ClimbStats;
  placements: ClimbPlacement[];
}

export interface ClimbStats {
  climb_uuid: string;
  angle: number;
  display_difficulty: number;
  grade?: string;
  quality_average: number;
  ascensionist_count: number;
  difficulty_average: number;
}

export interface ClimbListResponse {
  climbs: ClimbSummary[] | null;
  next_cursor?: string;
}

export interface Layout {
  id: number;
  product_id: number;
  name: string;
  is_listed: boolean;
}

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Ascent {
  id: number;
  user_id: number;
  climb_uuid: string;
  angle: number;
  is_send: boolean;
  proposed_grade?: number;
  quality?: number;
  comment?: string;
  created_at: string;
}

export interface AscentSummary extends Ascent {
  climb_name: string;
  grade?: string;
  username?: string;
}

export interface AscentListResponse {
  ascents: AscentSummary[] | null;
  total: number;
  page: number;
  limit: number;
}

export interface UserClimbSummary {
  attempts: number;
  sends: number;
}

export interface GradeCount {
  grade: string;
  count: number;
}

export interface MonthCount {
  month: string;
  count: number;
}

export interface AngleCount {
  angle: number;
  count: number;
}

export interface UserStats {
  total_ascents: number;
  total_sends: number;
  highest_grade: string;
  sends_by_grade: GradeCount[];
  sends_by_angle: AngleCount[];
  sends_by_month: MonthCount[];
}

export interface ClimbList {
  id: number;
  user_id: number;
  name: string;
  color: string;
  item_count: number;
  created_at: string;
}

export interface ClimbListDetail extends ClimbList {
  items: ClimbSummary[];
}

export interface ListMembership {
  list_id: number;
  name: string;
  color: string;
  contains: boolean;
}

export type HoldColor = 'yellow' | 'green' | 'blue' | 'pink' | null;

export const ROLE_COLORS: Record<number, HoldColor> = {
  12: 'green',
  13: 'blue',
  14: 'pink',
  15: 'yellow',
};

export const COLOR_TO_ROLE: Record<string, number> = {
  green: 12,
  blue: 13,
  pink: 14,
  yellow: 15,
};

export const COLOR_HEX: Record<string, string> = {
  yellow: '#FFD700',
  green: '#00E676',
  blue: '#42A5F5',
  pink: '#E040FB',
};

export const GRADE_LABELS: string[] = [
  'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7',
  'V8', 'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17',
];

export const ANGLES: number[] = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];

export function difficultyToGrade(difficulty: number): string {
  const index = Math.round(difficulty);
  if (index < 0) return GRADE_LABELS[0];
  if (index >= GRADE_LABELS.length) return GRADE_LABELS[GRADE_LABELS.length - 1];
  return GRADE_LABELS[index];
}
