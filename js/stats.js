// stats.js — statistics + chart rendering
import { getStats, getWeeklyData, formatDuration } from './attendance.js';

let chartInstance = null;

export function renderStats() {
  const s = getStats();
  document.getElementById('stat-streak').textContent    = s.streak;
  document.getElementById('stat-best').textContent      = s.bestStreak;
  document.getElementById('stat-compliance').textContent = s.compliance + '%';
  document.getElementById('stat-avgdur').textContent    = s.avgDuration > 0 ? formatDuration(s.avgDuration) : '--';
  document.getElementById('stat-days').textContent      = `${s.fullDays}/${s.totalDays}`;
  // Use rAF to wait for layout
  requestAnimationFrame(() => renderChart());
}

function renderChart() {
  const weekly = getWeeklyData();
  const canvas = document.getElementById('weekly-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  canvas.width = W;
  canvas.height = H;

  ctx.clearRect(0, 0, W, H);

  const maxVal = 12; // max hours displayed
  const barW = Math.floor((W - 40) / 7) - 4;
  const bottom = H - 24;
  const top = 12;
  const areaH = bottom - top;

  // grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  [0, 3, 6, 9].forEach(h => {
    const y = bottom - (h / maxVal) * areaH;
    ctx.beginPath(); ctx.moveTo(32, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '10px Inter';
    ctx.fillText(h + 'h', 0, y + 4);
  });

  // 9h reference line
  const refY = bottom - (9 / maxVal) * areaH;
  ctx.strokeStyle = 'rgba(0,212,170,0.3)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(32, refY); ctx.lineTo(W, refY); ctx.stroke();
  ctx.setLineDash([]);

  // bars
  weekly.forEach((day, i) => {
    const x = 36 + i * (barW + 4);
    const dur = Math.min(day.dur, maxVal);
    const barH = (dur / maxVal) * areaH;
    const y = bottom - barH;
    const ok = day.dur >= 9;

    // gradient
    const grad = ctx.createLinearGradient(x, y, x, bottom);
    grad.addColorStop(0, ok ? 'rgba(0,212,170,0.9)' : 'rgba(239,68,68,0.9)');
    grad.addColorStop(1, ok ? 'rgba(0,168,130,0.5)' : 'rgba(220,38,38,0.5)');

    const radius = 4;
    ctx.fillStyle = day.dur === 0 ? 'rgba(255,255,255,0.06)' : grad;
    ctx.beginPath();
    ctx.moveTo(x + radius, day.dur === 0 ? bottom - 2 : y);
    if (day.dur > 0) {
      ctx.arcTo(x+barW, y, x+barW, bottom, radius);
      ctx.arcTo(x+barW, bottom, x, bottom, radius);
      ctx.arcTo(x, bottom, x, y, radius);
      ctx.arcTo(x, y, x+barW, y, radius);
    } else {
      ctx.rect(x, bottom-2, barW, 2);
    }
    ctx.closePath();
    ctx.fill();

    // label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(day.label.slice(0,2), x + barW/2, H - 4);
  });
}
