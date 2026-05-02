// app.js — main controller
import { Storage } from './storage.js';
import { markIN, markOUT, todayKey, inWindow, outWindow, calcDuration, formatDuration, getDayStatus, getStats } from './attendance.js';
import { initCalendar, renderCalendar } from './calendar.js';
import { renderStats } from './stats.js';
import { Notifications } from './notifications.js';
import { initTheme, toggleTheme, applyTheme } from './theme.js';

// ── Init ───────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  registerSW();

  const profile = Storage.getProfile();
  if (!profile) {
    showScreen('onboarding');
  } else {
    showScreen('dashboard');
    init();
  }
});

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => { window._sw = reg; })
      .catch(console.warn);
  }
}

// ── Onboarding ─────────────────────────────────────────
document.getElementById('onboard-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('ob-name').value.trim();
  const roll = document.getElementById('ob-roll').value.trim();
  if (!name || !roll) return;
  Storage.setProfile({ name, roll });
  const settings = Storage.getSettings();
  settings.startDate = '2026-05-01';
  Storage.setSettings(settings);
  showScreen('dashboard');
  init();
  askNotifPermission();
});

// ── Core init ──────────────────────────────────────────
function init() {
  const p = Storage.getProfile();
  document.getElementById('user-roll').textContent = p.roll;
  renderDashboard();
  initCalendar(onDayClick);
  renderStats();
  startClock();
  checkNotifBanner();
}

// ── Screen routing ─────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${id}`)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.screen === id);
  });
  // hide topbar on onboarding
  const topbar = document.getElementById('topbar');
  const nav    = document.getElementById('bottom-nav');
  if (topbar) topbar.style.display = id === 'onboarding' ? 'none' : '';
  if (nav)    nav.style.display    = id === 'onboarding' ? 'none' : '';
}

document.querySelectorAll('.nav-item').forEach(n => {
  n.addEventListener('click', () => {
    const s = n.dataset.screen;
    showScreen(s);
    if (s === 'stats') renderStats();
    if (s === 'calendar') renderCalendar(onDayClick);
  });
});

// ── Dashboard ──────────────────────────────────────────
function renderDashboard() {
  const today = todayKey();
  const rec = Storage.getRecord(today);

  // Date display
  const now = new Date();
  document.getElementById('today-date').textContent =
    now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  // IN box
  updateBox('in', rec.in);
  // OUT box
  updateBox('out', rec.out);

  // Buttons
  const btnIn  = document.getElementById('btn-in');
  const btnOut = document.getElementById('btn-out');
  btnIn.disabled  = !!rec.in  || !inWindow();
  btnOut.disabled = !!rec.out || !outWindow() || !rec.in;

  // Window hint
  const hint = document.getElementById('window-hint');
  const n = now.getHours()*60 + now.getMinutes();
  if (n < 7*60+30)        hint.textContent = 'IN window opens at 7:30 AM';
  else if (inWindow())    hint.textContent = '✅ IN window open — 7:30–9:30 AM';
  else if (n < 17*60)     hint.textContent = 'OUT window opens at 5:00 PM';
  else if (outWindow())   hint.textContent = '✅ OUT window open — 5:00–10:00 PM';
  else                    hint.textContent = 'Attendance windows closed for today';

  // Duration bar
  if (rec.in && rec.out) {
    const dur = calcDuration(rec.in, rec.out);
    const pct = Math.min((dur / 12) * 100, 100);
    const fill = document.getElementById('dur-fill');
    const label = document.getElementById('dur-label');
    fill.style.width = pct + '%';
    fill.className = 'duration-fill' + (dur < 9 ? ' warn' : '');
    label.textContent = formatDuration(dur) + (dur < 9 ? ' ⚠️ < 9h required' : ' ✅ Duration OK');
    document.getElementById('dur-bar-wrap').style.display = '';
  } else if (rec.in) {
    // live timer
    const [ih,im] = rec.in.split(':').map(Number);
    const elapsed = (n - (ih*60+im)) / 60;
    const pct = Math.min((elapsed / 12) * 100, 100);
    document.getElementById('dur-fill').style.width = pct + '%';
    document.getElementById('dur-label').textContent = formatDuration(elapsed) + ' elapsed';
    document.getElementById('dur-bar-wrap').style.display = '';
  } else {
    document.getElementById('dur-bar-wrap').style.display = 'none';
  }

  // Quick stats
  renderQuickStats();
}

function updateBox(type, time) {
  const box = document.getElementById(`att-box-${type}`);
  const timeEl = box.querySelector('.att-box-time');
  const iconEl = box.querySelector('.att-box-icon');
  if (time) {
    box.classList.add('done');
    timeEl.textContent = formatTime(time);
    iconEl.textContent = '✅';
  } else {
    box.classList.remove('done');
    timeEl.textContent = '--:--';
    iconEl.textContent = type === 'in' ? '⏳' : '⏳';
  }
}

function formatTime(t) {
  const [h,m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${((h%12)||12)}:${m.toString().padStart(2,'0')} ${ampm}`;
}

function renderQuickStats() {
  const s = getStats();
  document.getElementById('qs-streak').textContent     = s.streak + ' 🔥';
  document.getElementById('qs-compliance').textContent = s.compliance + '%';
  document.getElementById('qs-days').textContent       = `${s.fullDays}/${s.totalDays}`;
}

// ── Clock ──────────────────────────────────────────────
function startClock() {
  setInterval(renderDashboard, 60 * 1000);
}

// ── Mark IN/OUT ────────────────────────────────────────
document.getElementById('btn-in').addEventListener('click', () => {
  if (!inWindow() && !confirm('You are outside the IN window (7:30–9:30 AM). Record anyway?')) return;
  const time = markIN();
  updateBox('in', time);
  renderDashboard();
  showToast('✅ IN marked at ' + formatTime(time));
});

document.getElementById('btn-out').addEventListener('click', () => {
  if (!outWindow() && !confirm('You are outside the OUT window (5:00–10:00 PM). Record anyway?')) return;
  const time = markOUT();
  updateBox('out', time);
  renderDashboard();
  const rec = Storage.getRecord(todayKey());
  const dur = calcDuration(rec.in, time);
  if (dur < 9) showToast(`⚠️ Duration ${formatDuration(dur)} — less than 9 hours!`, 'warn');
  else showToast('✅ OUT marked at ' + formatTime(time) + ` (${formatDuration(dur)})`);
});

// ── Calendar day click ─────────────────────────────────
function onDayClick(date, status) {
  const rec = Storage.getRecord(date);
  openDayModal(date, rec, status);
}

function openDayModal(date, rec, status) {
  const modal = document.getElementById('day-modal');
  const overlay = document.getElementById('modal-overlay');

  document.getElementById('modal-date').textContent =
    new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });

  document.getElementById('modal-in').value   = rec.in   || '';
  document.getElementById('modal-out').value  = rec.out  || '';
  document.getElementById('modal-note').value = rec.note || '';
  document.getElementById('modal-holiday').checked = !!rec.holiday;

  document.getElementById('modal-save').onclick = () => {
    const inT  = document.getElementById('modal-in').value;
    const outT = document.getElementById('modal-out').value;
    const note = document.getElementById('modal-note').value.trim();
    const holiday = document.getElementById('modal-holiday').checked;
    Storage.setRecord(date, { in: inT||undefined, out: outT||undefined, note, holiday });
    closeModal();
    renderCalendar(onDayClick);
    if (date === todayKey()) renderDashboard();
    showToast('Saved!');
  };
  document.getElementById('modal-cancel').onclick = closeModal;
  overlay.classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ── Settings ───────────────────────────────────────────
document.getElementById('btn-settings').addEventListener('click', () => showScreen('settings'));
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

document.getElementById('settings-theme-toggle').addEventListener('change', function() {
  const s = Storage.getSettings();
  s.theme = this.checked ? 'light' : 'dark';
  Storage.setSettings(s);
  applyTheme(s.theme);
  document.getElementById('theme-toggle').textContent = s.theme === 'dark' ? '☀️' : '🌙';
});

document.getElementById('settings-notif-toggle').addEventListener('change', async function() {
  if (this.checked) {
    const granted = await Notifications.request();
    if (!granted) { this.checked = false; showToast('Notification permission denied'); return; }
    if (window._sw) Notifications.schedule(window._sw);
  }
  const s = Storage.getSettings();
  s.notifs = this.checked;
  Storage.setSettings(s);
});

document.getElementById('btn-export-json').addEventListener('click', () => { Storage.exportJSON(); showToast('JSON exported!'); });
document.getElementById('btn-export-csv').addEventListener('click',  () => { Storage.exportCSV();  showToast('CSV exported!'); });
document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
document.getElementById('import-file').addEventListener('change', async function() {
  if (!this.files[0]) return;
  try {
    await Storage.importJSON(this.files[0]);
    showToast('Data imported! Refreshing...');
    setTimeout(() => location.reload(), 1000);
  } catch { showToast('Import failed — invalid file', 'warn'); }
  this.value = '';
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (confirm('⚠️ This will DELETE all your attendance data. Are you sure?')) {
    localStorage.clear();
    location.reload();
  }
});

// Load settings into UI
function loadSettingsUI() {
  const s = Storage.getSettings();
  document.getElementById('settings-theme-toggle').checked = s.theme === 'light';
  document.getElementById('settings-notif-toggle').checked = s.notifs && Notifications.granted();
  const p = Storage.getProfile();
  if (p) {
    document.getElementById('settings-name').textContent = p.name;
    document.getElementById('settings-roll').textContent = p.roll;
  }
}
document.querySelector('[data-screen="settings"]').addEventListener('click', loadSettingsUI);

// ── Notification banner ────────────────────────────────
function checkNotifBanner() {
  const banner = document.getElementById('notif-banner');
  if (!Notifications.granted() && 'Notification' in window) {
    banner.classList.add('show');
    banner.addEventListener('click', askNotifPermission);
  }
}
async function askNotifPermission() {
  const granted = await Notifications.request();
  if (granted) {
    document.getElementById('notif-banner').classList.remove('show');
    if (window._sw) Notifications.schedule(window._sw);
    const s = Storage.getSettings();
    s.notifs = true;
    Storage.setSettings(s);
    showToast('🔔 Notifications enabled!');
  }
}

// ── Toast ──────────────────────────────────────────────
function showToast(msg, type = 'ok') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
      background:var(--bg2);border:1px solid var(--border);border-radius:12px;
      padding:12px 20px;font-size:0.9rem;font-weight:500;z-index:999;
      box-shadow:var(--shadow);transition:opacity 0.3s;max-width:90vw;text-align:center;`;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}
