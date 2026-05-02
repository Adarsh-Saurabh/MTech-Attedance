// calendar.js — calendar rendering
import { Storage } from './storage.js';
import { getDayStatus, todayKey } from './attendance.js';

let currentYear, currentMonth;

const STATUS_CLASS = {
  full: 'full', short: 'partial', partial: 'partial',
  missed: 'missed', holiday: 'holiday', weekend: 'holiday',
  future: 'future', 'before-start': ''
};

export function initCalendar(onDayClick) {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  document.getElementById('cal-prev').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar(onDayClick);
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar(onDayClick);
  });
  renderCalendar(onDayClick);
}

export function renderCalendar(onDayClick) {
  const el = document.getElementById('cal-grid');
  const title = document.getElementById('cal-month-title');
  const today = todayKey();

  title.textContent = new Date(currentYear, currentMonth, 1)
    .toLocaleDateString('en', { month: 'long', year: 'numeric' });

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  // shift so Mon=0
  const offset = (firstDay + 6) % 7;

  el.innerHTML = '';
  // empty cells
  for (let i = 0; i < offset; i++) el.appendChild(emptyCell());
  // day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const status = getDayStatus(dateStr);
    const cls = STATUS_CLASS[status] || '';
    const isToday = dateStr === today;

    const cell = document.createElement('div');
    cell.className = `cal-day ${cls} ${isToday ? 'today' : ''}`.trim();
    cell.innerHTML = `<span>${d}</span>${cls && cls !== 'future' ? '<div class="cal-dot"></div>' : ''}`;

    if (status !== 'future' && status !== 'before-start') {
      cell.addEventListener('click', () => onDayClick(dateStr, status));
    } else {
      cell.classList.add('empty');
    }
    el.appendChild(cell);
  }
}

function emptyCell() {
  const div = document.createElement('div');
  div.className = 'cal-day empty';
  return div;
}
