// theme.js — dark/light toggle
import { Storage } from './storage.js';

export function initTheme() {
  const s = Storage.getSettings();
  applyTheme(s.theme || 'dark');
}

export function toggleTheme() {
  const s = Storage.getSettings();
  const next = s.theme === 'dark' ? 'light' : 'dark';
  s.theme = next;
  Storage.setSettings(s);
  applyTheme(next);
  return next;
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  const tog = document.getElementById('settings-theme-toggle');
  if (tog) tog.checked = theme === 'light';
}
