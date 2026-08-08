const canvas = document.getElementById('radarCanvas');
const ctx = canvas.getContext('2d');
const alertEl = document.getElementById('danger-alert');
const scoreEl = document.getElementById('score-val');
const sepEl = document.getElementById('sep-val');
const levelEl = document.getElementById('level-num');

const PX_PER_NM = 60; // 60px = 1 Nautical Mile
let currentLevelIdx = 0;
let levels = [];
let planes = [];
let waypoint = { name: "MOD", x: 750, y: 260 };
let score = 0;
let activePlane = null;
let sweepAngle = 0;

// Web Audio API Synth Effects
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playAudioTone(freq, type = 'sine', duration = 0.1) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

// Load Levels from levels.json
async function initGame() {
  const res = await fetch('levels.json');
  levels = await res.json();
  loadLevel(currentLevelIdx);
  requestAnimationFrame(gameLoop);
}

function loadLevel(idx) {
  const lvl = levels[idx];
  levelEl.textContent = lvl.level;
  waypoint = lvl.targetWaypoint;
  planes = lvl.aircraft.map(p => ({
    ...p,
    startX: p.x,
    startY: p.y,
    history: []
  }));
}

// Mouse Controls
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  planes.forEach(p => {
    if (Math.hypot(p.x - mx, p.y - my) < 25) {
      activePlane = p;
      playAudioTone(1000, 'sine', 0.05);
    }
  });
});

canvas.addEventListener('mousemove', (e) => {
  if (activePlane) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const dx = mx - activePlane.x;
    // Map drag distance to speed (200 kts to 600 kts)
    const newSpeed = Math.min(600, Math.max(200, Math.round((dx / 120) * 400 + 200)));
    if (Math.abs(newSpeed - activePlane.speed) >= 20) {
      activePlane.speed = newSpeed;
      playAudioTone(500 + newSpeed, 'triangle', 0.03);
    }
  }
});

window.addEventListener('mouseup', () => {
  if (activePlane) {
    activePlane = null;
  }
});

let lastTime = performance.now();

function gameLoop(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

function update(dt) {
  sweepAngle += dt * 2.5;

  let minSep = 999;

  planes.forEach((p, i) => {
    // Record visual trailing dots
    if (Math.random() < 0.25) p.history.push({ x: p.x, y: p.y, alpha: 0.6 });
    p.history.forEach(h => h.alpha -= dt * 0.4);
    p.history = p.history.filter(h => h.alpha > 0);

    // Movement toward waypoint
    const speedPx = (p.speed / 12) * dt * 10;
    if (p.x < waypoint.x) {
      p.x += speedPx;
      p.y += (waypoint.y - p.y) * 0.015 * (speedPx / 5);
    } else {
      p.x += speedPx;
    }

    // Reset loop
    if (p.x > canvas.width + 80) {
      p.x = p.startX;
      p.y = p.startY;
      score += 150;
      scoreEl.textContent = score;
      playAudioTone(1200, 'sine', 0.15);
    }

    // Calculate separation between aircraft pairs
    for (let j = i + 1; j < planes.length; j++) {
      const other = planes[j];
      const distPx = Math.hypot(p.x - other.x, p.y - other.y);
      const distNM = distPx / PX_PER_NM;
      if (distNM < minSep) minSep = distNM;
    }
  });

  if (planes.length > 1) {
    sepEl.textContent = `${minSep.toFixed(1)} NM`;
    if (minSep < 3.0) {
      sepEl.className = "danger";
      alertEl.classList.remove('hidden');
      if (Math.random() < 0.08) playAudioTone(250, 'sawtooth', 0.08);
    } else {
      sepEl.className = "safe";
      alertEl.classList.add('hidden');
    }
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.strokeStyle = 'rgba(0, 255, 204, 0.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += PX_PER_NM) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += PX_PER_NM) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  // Radar Sweep
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, canvas.height / 2);
  ctx.arc(canvas.width / 2, canvas.height / 2, 600, sweepAngle, sweepAngle + 0.15);
  ctx.fillStyle = 'rgba(0, 255, 204, 0.03)';
  ctx.fill();
  ctx.restore();

  // Waypoint
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath(); ctx.arc(waypoint.x, waypoint.y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.font = '12px "Orbitron"';
  ctx.fillText(waypoint.name, waypoint.x - 15, waypoint.y + 24);

  // Planes
  planes.forEach(p => {
    // Trails
    p.history.forEach(h => {
      ctx.fillStyle = `rgba(0, 255, 204, ${h.alpha * 0.5})`;
      ctx.beginPath(); ctx.arc(h.x, h.y, 2, 0, Math.PI * 2); ctx.fill();
    });

    // 3 NM Safety Buffer Ring
    ctx.strokeStyle = p === activePlane ? '#ffffff' : p.color + '44';
    ctx.fillStyle = p.color + '0d';
    ctx.lineWidth = p === activePlane ? 2 : 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.5 * PX_PER_NM, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Aircraft Icon
    ctx.fillStyle = p === activePlane ? '#ffffff' : p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();

    // Vector Vector Line
    const vecLen = (p.speed / 400) * 100;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + vecLen, p.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x + vecLen, p.y, 4, 0, Math.PI * 2); ctx.fill();

    // Data Tag
    ctx.fillStyle = '#fff';
    ctx.font = '11px "Share Tech Mono"';
    ctx.fillText(p.id, p.x + 10, p.y - 10);
    ctx.fillText(`${p.speed} KTS`, p.x + 10, p.y + 4);
  });
}

initGame();
