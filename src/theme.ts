import type { ThemeMode } from './types';

export const palettes = {
  dark: {
    bg: '#0f1117',
    bg2: '#161b27',
    bg3: '#1e2535',
    glass: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.09)',
    primary: '#00d4aa',
    primaryDark: '#00a882',
    indigo: '#6366f1',
    amber: '#f59e0b',
    red: '#ef4444',
    text: '#f1f5f9',
    text2: '#94a3b8',
    text3: '#64748b',
  },
  light: {
    bg: '#f0f4f8',
    bg2: '#ffffff',
    bg3: '#e8edf5',
    glass: 'rgba(255,255,255,0.75)',
    border: 'rgba(15,23,42,0.09)',
    primary: '#00a882',
    primaryDark: '#047857',
    indigo: '#4f46e5',
    amber: '#d97706',
    red: '#dc2626',
    text: '#1e293b',
    text2: '#64748b',
    text3: '#94a3b8',
  },
} as const;

export function getPalette(theme: ThemeMode) {
  return palettes[theme];
}
