import {
  AscentListResponse,
  BoardLayout,
  ClimbDetail,
  ClimbListResponse,
  DifficultyGrade,
  Layout,
  User,
  UserClimbSummary,
  UserStats,
  Ascent,
} from '../types';

const API_BASE = __DEV__
  ? 'http://localhost:8080/api'
  : 'http://localhost:8080/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export interface ClimbSearchParams {
  name?: string;
  grade_min?: number;
  grade_max?: number;
  angle?: number;
  no_match?: boolean;
  cursor?: string;
  limit?: number;
}

export async function fetchClimbs(params: ClimbSearchParams = {}): Promise<ClimbListResponse> {
  const query = new URLSearchParams();
  if (params.name) query.set('name', params.name);
  if (params.grade_min !== undefined) query.set('grade_min', String(params.grade_min));
  if (params.grade_max !== undefined) query.set('grade_max', String(params.grade_max));
  if (params.angle !== undefined) query.set('angle', String(params.angle));
  if (params.no_match !== undefined) query.set('no_match', String(params.no_match));
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const qs = query.toString();
  return request<ClimbListResponse>(`/climbs${qs ? `?${qs}` : ''}`);
}

export async function fetchClimb(uuid: string): Promise<ClimbDetail> {
  return request<ClimbDetail>(`/climbs/${uuid}`);
}

export async function createClimb(data: {
  layout_id: number;
  name: string;
  frames: string;
}): Promise<ClimbDetail> {
  return request<ClimbDetail>('/climbs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function publishClimb(
  uuid: string,
  data: { name: string; grade: number; angle: number }
): Promise<void> {
  await request(`/climbs/${uuid}/publish`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function fetchBoardLayout(layoutId: number = 1): Promise<BoardLayout> {
  return request<BoardLayout>(`/board/layout?layout_id=${layoutId}`);
}

export async function fetchLayouts(): Promise<Layout[]> {
  return request<Layout[]>('/board/layouts');
}

export async function sendToBoard(uuid: string): Promise<void> {
  await request(`/board/send/${uuid}`, { method: 'POST' });
}

export async function fetchGrades(): Promise<DifficultyGrade[]> {
  return request<DifficultyGrade[]>('/grades');
}

// Users

export async function createUser(username: string): Promise<User> {
  return request<User>('/users', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

export async function getUser(id: number): Promise<User> {
  return request<User>(`/users/${id}`);
}

export async function getUserByUsername(username: string): Promise<User> {
  return request<User>(`/users/by-username/${username}`);
}

// Ascents

export async function logAscent(
  climbUUID: string,
  data: {
    user_id: number;
    angle: number;
    is_send: boolean;
    proposed_grade?: number;
    quality?: number;
    comment?: string;
  }
): Promise<Ascent> {
  return request<Ascent>(`/climbs/${climbUUID}/ascents`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchClimbAscents(
  climbUUID: string,
  page = 1,
  limit = 20
): Promise<AscentListResponse> {
  return request<AscentListResponse>(
    `/climbs/${climbUUID}/ascents?page=${page}&limit=${limit}`
  );
}

export async function fetchUserAscents(
  userId: number,
  page = 1,
  limit = 20,
  sendsOnly = false
): Promise<AscentListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (sendsOnly) params.set('sends_only', 'true');
  return request<AscentListResponse>(`/users/${userId}/ascents?${params}`);
}

export async function fetchUserStats(userId: number): Promise<UserStats> {
  return request<UserStats>(`/users/${userId}/stats`);
}

export async function fetchUserClimbSummary(
  userId: number,
  climbUUID: string
): Promise<UserClimbSummary> {
  return request<UserClimbSummary>(`/users/${userId}/climb-summary/${climbUUID}`);
}
