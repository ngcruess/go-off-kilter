// ---------- Previous palette (neon / OLED) ----------
// export const colors = {
//   pageBg: '#0a0a0a',
//   boardBg: '#0d0d0d',
//   surface: '#111',
//   surfaceRaised: '#1a1a1a',
//   surfaceInput: '#1e1e1e',
//   chip: '#2a2a2a',
//   textPrimary: '#fff',
//   textSecondary: '#888',
//   textTertiary: '#aaa',
//   textMuted: '#666',
//   textDisabled: '#444',
//   textOnAccent: '#000',
//   accent: '#00E5FF',
//   accentGreen: '#4dba8a',
//   accentGreenBg: '#163028',
//   error: '#ff6b6b',
//   errorMuted: '#e57373',
//   errorBg: '#2a1a1a',
//   errorBorder: '#3a2a2a',
//   success: '#00E676',
//   sendBadge: '#2e7d32',
//   star: '#FFD700',
//   borderSubtle: '#222',
//   border: '#333',
//   borderMedium: '#444',
//   borderCard: '#2a2a2a',
//   overlay: 'rgba(0,0,0,0.6)',
//   overlayDark: 'rgba(0,0,0,0.7)',
//   chartGrade: '#42A5F5',
//   chartAngle: '#FFA726',
//   chartTime: '#66BB6A',
//   holdYellow: '#FFD700',
//   holdGreen: '#00E676',
//   holdBlue: '#42A5F5',
//   holdPink: '#E040FB',
//   holdUnselectedFill: '#222222',
//   holdUnselectedStroke: '#333333',
//   holdCenterFill: '#1a1a1a',
//   listPalette: [...],
// };

// ---------- Current palette (slate / muted) ----------
// Base:      HSL(210, 10%, 12%)  →  #1b1f22
// Tile:      HSL(210,  8%, 22%)  →  #34383d
// Accent:    HSL(214, 30%, 55%)  →  #6a88af
// Success:   HSL(150, 25%, 35%)  →  #437059
// Danger:    HSL( 15, 50%, 45%)  →  #ac5639
// Text 1:    HSL( 40, 15%, 92%)  →  #eeece7
// Text 2:    HSL(210,  5%, 65%)  →  #a1a6aa

export const colors = {
  // Backgrounds
  pageBg: '#1b1f22',
  boardBg: '#161a1d',
  surface: '#272b30',
  surfaceRaised: '#34383d',
  surfaceInput: '#2d3136',
  chip: '#3d4148',

  // Text
  textPrimary: '#eeece7',
  textSecondary: '#a1a6aa',
  textTertiary: '#848890',
  textMuted: '#6b6f75',
  textDisabled: '#4e5258',
  textOnAccent: '#1b1f22',

  // Accent
  accent: '#6a88af',
  accentGreen: '#5a9474',
  accentGreenBg: '#3d6652',

  // Semantic
  error: '#ac5639',
  errorMuted: '#c47a5e',
  errorBg: '#3d2a22',
  errorBorder: '#5c3d2e',
  success: '#437059',
  sendBadge: '#437059',
  star: '#d4a94e',

  // Borders
  borderSubtle: '#2a2e33',
  border: '#3d4148',
  borderMedium: '#4e5258',
  borderCard: '#34383d',

  // Overlays
  overlay: 'rgba(0,0,0,0.55)',
  overlayDark: 'rgba(0,0,0,0.65)',

  // Chart
  chartGrade: '#6a88af',
  chartAngle: '#d4a94e',
  chartTime: '#5a9474',

  // Hold domain colors
  holdYellow: '#d4a94e',
  holdGreen: '#5a9474',
  holdBlue: '#6a88af',
  holdPink: '#b06a8f',
  holdUnselectedFill: '#2a2e33',
  holdUnselectedStroke: '#3d4148',
  holdCenterFill: '#272b30',

  // User-selectable list palette
  listPalette: [
    '#6a88af', '#5a9474', '#d4a94e', '#ac5639',
    '#b06a8f', '#5a8a8a', '#c4785a', '#7a6a5a',
    '#6a7a8a', '#c4b44e',
  ] as readonly string[],
};
