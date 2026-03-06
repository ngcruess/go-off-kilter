import {
  AscentListResponse,
  BoardLayout,
  ClimbDetail,
  ClimbList,
  ClimbListDetail,
  ClimbListResponse,
  ClimbSummary,
  DifficultyGrade,
  Layout,
  ListMembership,
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
  setter?: string;
  grade_min?: number;
  grade_max?: number;
  angle?: number;
  set_angle?: number;
  no_match?: boolean;
  user_id?: number;
  user_filter?: 'attempted' | 'sent' | 'not_sent';
  sort?: 'ascents' | 'date' | 'rating' | 'name';
  order?: 'asc' | 'desc';
  cursor?: string;
  limit?: number;
}

export async function fetchClimbs(params: ClimbSearchParams = {}): Promise<ClimbListResponse> {
  const query = new URLSearchParams();
  if (params.name) query.set('name', params.name);
  if (params.setter) query.set('setter', params.setter);
  if (params.grade_min !== undefined) query.set('grade_min', String(params.grade_min));
  if (params.grade_max !== undefined) query.set('grade_max', String(params.grade_max));
  if (params.angle !== undefined) query.set('angle', String(params.angle));
  if (params.set_angle !== undefined) query.set('set_angle', String(params.set_angle));
  if (params.no_match !== undefined) query.set('no_match', String(params.no_match));
  if (params.user_id !== undefined) query.set('user_id', String(params.user_id));
  if (params.user_filter) query.set('user_filter', params.user_filter);
  if (params.sort) query.set('sort', params.sort);
  if (params.order) query.set('order', params.order);
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const qs = query.toString();
  return request<ClimbListResponse>(`/climbs${qs ? `?${qs}` : ''}`);
}

export async function fetchClimb(uuid: string, angle?: number): Promise<ClimbDetail> {
  const qs = angle !== undefined ? `?angle=${angle}` : '';
  return request<ClimbDetail>(`/climbs/${uuid}${qs}`);
}

export async function createClimb(data: {
  layout_id: number;
  setter_id: number;
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

// User climbs

export async function fetchUserSetClimbs(
  userId: number,
  angle?: number,
  limit = 20
): Promise<ClimbSummary[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (angle !== undefined) params.set('angle', String(angle));
  return request<ClimbSummary[]>(`/users/${userId}/climbs-set?${params}`);
}

// Follows

export async function searchUsers(query: string, limit = 20): Promise<User[]> {
  return request<User[]>(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export async function followUser(userId: number, followedId: number): Promise<void> {
  await request(`/users/${userId}/following`, {
    method: 'POST',
    body: JSON.stringify({ followed_id: followedId }),
  });
}

export async function unfollowUser(userId: number, followedId: number): Promise<void> {
  await request(`/users/${userId}/following/${followedId}`, { method: 'DELETE' });
}

export async function fetchFollowing(userId: number): Promise<User[]> {
  return request<User[]>(`/users/${userId}/following`);
}

export async function checkIsFollowing(userId: number, followedId: number): Promise<boolean> {
  const res = await request<{ following: boolean }>(`/users/${userId}/following/${followedId}`);
  return res.following;
}

// Lists

export async function fetchUserLists(userId: number): Promise<ClimbList[]> {
  return request<ClimbList[]>(`/users/${userId}/lists`);
}

export async function createList(userId: number, name: string, color?: string): Promise<ClimbList> {
  return request<ClimbList>(`/users/${userId}/lists`, {
    method: 'POST',
    body: JSON.stringify({ name, color: color || '#42A5F5' }),
  });
}

export async function fetchList(listId: number, angle?: number): Promise<ClimbListDetail> {
  const qs = angle !== undefined ? `?angle=${angle}` : '';
  return request<ClimbListDetail>(`/lists/${listId}${qs}`);
}

export async function addToList(listId: number, climbUUID: string): Promise<void> {
  await request(`/lists/${listId}/items`, {
    method: 'POST',
    body: JSON.stringify({ climb_uuid: climbUUID }),
  });
}

export async function removeFromList(listId: number, climbUUID: string): Promise<void> {
  await request(`/lists/${listId}/items/${climbUUID}`, { method: 'DELETE' });
}

export async function fetchListsForClimb(
  userId: number,
  climbUUID: string
): Promise<ListMembership[]> {
  return request<ListMembership[]>(`/users/${userId}/lists/for-climb/${climbUUID}`);
}
