const holeList = document.getElementById('holeList');
const guessInput = document.getElementById('guessInput');
const guessBtn = document.getElementById('guessBtn');
const skipBtn = document.getElementById('skipBtn');
const suggestionsEl = document.getElementById('suggestions');
const guessHistory = document.getElementById('guessHistory');
const resultBanner = document.getElementById('resultBanner');
const resultOverlay = document.getElementById('resultOverlay');
const closeResultBtn = document.getElementById('closeResultBtn');
const viewResultBtn = document.getElementById('viewResultBtn');
const stampEl = document.getElementById('stamp');
const answerLine = document.getElementById('answerLine');
const countdownLine = document.getElementById('countdownLine');
const shareGrid = document.getElementById('shareGrid');
const shareBtn = document.getElementById('shareBtn');
const modeToggle = document.getElementById('modeToggle');
const dateline = document.getElementById('dateline');
const eyebrow = document.getElementById('eyebrow');
const dailyTab = document.getElementById('dailyTab');
const unlimitedTab = document.getElementById('unlimitedTab');
const newRoundBtn = document.getElementById('newRoundBtn');
const streakBadge = document.getElementById('streakBadge');
const helpBtn = document.getElementById('helpBtn');
const helpOverlay = document.getElementById('helpOverlay');
const closeHelpBtn = document.getElementById('closeHelpBtn');
const statsBtn = document.getElementById('statsBtn');
const statsOverlay = document.getElementById('statsOverlay');
const closeStatsBtn = document.getElementById('closeStatsBtn');
const statsGrid = document.getElementById('statsGrid');
const distributionEl = document.getElementById('distribution');
const soundBtn = document.getElementById('soundBtn');

let allGolfers = [];
let highlightedIndex = -1;
let gameType = 'daily'; // 'daily' or 'unlimited'

/* ---------------- Sound ---------------- */

const SOUND_KEY = 'schefflerdle_sound_v1';
let soundEnabled = localStorage.getItem(SOUND_KEY) !== 'off';

function updateSoundBtn() {
  soundBtn.textContent = soundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
  soundBtn.classList.toggle('muted', !soundEnabled);
}

function playTone(freq, duration, type, vol) {
  if (!soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.value = vol || 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  } catch (e) { /* audio not available, fail silently */ }
}

function playCorrectSound() {
  playTone(660, 0.12, 'sine', 0.15);
  setTimeout(() => playTone(880, 0.18, 'sine', 0.15), 90);
}

function playWrongSound() {
  playTone(180, 0.2, 'triangle', 0.12);
}

soundBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem(SOUND_KEY, soundEnabled ? 'on' : 'off');
  updateSoundBtn();
});
updateSoundBtn();

/* ---------------- Confetti ---------------- */

function launchConfetti() {
  const colors = ['#C9A66B', '#B23A2E', '#3E7D52', '#EFE6D2'];
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = (Math.random() * 0.4) + 's';
    piece.style.animationDuration = (2 + Math.random() * 1.5) + 's';
    container.appendChild(piece);
  }
  setTimeout(() => container.remove(), 3500);
}

/* ---------------- Stats (Daily only, stored in localStorage) ---------------- */

const STATS_KEY = 'schefflerdle_stats_v1';

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore corrupt storage */ }
  return {
    gamesPlayed: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastWinDate: null,
    lastRecordedDate: null,
    distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "fail": 0 }
  };
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function recordDailyResult(state) {
  const stats = loadStats();
  const todayStr = new Date().toDateString();
  if (stats.lastRecordedDate === todayStr) return stats; // already recorded today

  stats.gamesPlayed += 1;
  if (state.solved) {
    stats.wins += 1;
    const n = String(state.guesses.length);
    stats.distribution[n] = (stats.distribution[n] || 0) + 1;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (stats.lastWinDate === yesterday.toDateString()) {
      stats.currentStreak += 1;
    } else {
      stats.currentStreak = 1;
    }
    stats.lastWinDate = todayStr;
    if (stats.currentStreak > stats.maxStreak) stats.maxStreak = stats.currentStreak;
  } else {
    stats.distribution.fail = (stats.distribution.fail || 0) + 1;
    stats.currentStreak = 0;
  }
  stats.lastRecordedDate = todayStr;
  saveStats(stats);
  return stats;
}

function updateStreakBadge() {
  const stats = loadStats();
  if (gameType === 'daily' && stats.currentStreak > 0) {
    streakBadge.textContent = '\uD83D\uDD25 ' + stats.currentStreak + '-day streak';
    streakBadge.style.display = 'inline-block';
  } else {
    streakBadge.style.display = 'none';
  }
}

function renderStatsModal() {
  const stats = loadStats();
  const winPct = stats.gamesPlayed ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
  statsGrid.innerHTML = `
    <div><div class="stats-num">${stats.gamesPlayed}</div><div class="stats-label">PLAYED</div></div>
    <div><div class="stats-num">${winPct}</div><div class="stats-label">WIN %</div></div>
    <div><div class="stats-num">${stats.currentStreak}</div><div class="stats-label">STREAK</div></div>
    <div><div class="stats-num">${stats.maxStreak}</div><div class="stats-label">MAX STREAK</div></div>
  `;
  const rows = [
    ['1', 'HOLE IN ONE'], ['2', 'EAGLE'], ['3', 'BIRDIE'],
    ['4', 'PAR'], ['5', 'BOGEY'], ['6', 'DOUBLE BOGEY'], ['fail', 'PICKED UP']
  ];
  const maxCount = Math.max(1, ...rows.map(r => stats.distribution[r[0]] || 0));
  distributionEl.innerHTML = rows.map(([key, label]) => {
    const count = stats.distribution[key] || 0;
    const pct = count === 0 ? 4 : Math.max(10, Math.round((count / maxCount) * 100));
    return `<div class="dist-row">
      <div class="dist-label">${label}</div>
      <div class="dist-bar-wrap"><div class="dist-bar" style="width:${pct}%">${count}</div></div>
    </div>`;
  }).join('');
}

statsBtn.addEventListener('click', () => {
  renderStatsModal();
  statsOverlay.classList.add('visible');
});
closeStatsBtn.addEventListener('click', () => statsOverlay.classList.remove('visible'));
statsOverlay.addEventListener('click', (e) => {
  if (e.target === statsOverlay) statsOverlay.classList.remove('visible');
});

/* ---------------- Help modal ---------------- */

const HELP_SEEN_KEY = 'schefflerdle_help_seen_v1';

helpBtn.addEventListener('click', () => helpOverlay.classList.add('visible'));
closeHelpBtn.addEventListener('click', () => {
  helpOverlay.classList.remove('visible');
  localStorage.setItem(HELP_SEEN_KEY, 'yes');
});
helpOverlay.addEventListener('click', (e) => {
  if (e.target === helpOverlay) {
    helpOverlay.classList.remove('visible');
    localStorage.setItem(HELP_SEEN_KEY, 'yes');
  }
});

/* ---------------- Countdown to next daily puzzle ---------------- */

let countdownInterval = null;

function msUntilMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next - now;
}

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function startCountdown() {
  stopCountdown();
  countdownLine.style.display = 'block';
  function tick() {
    countdownLine.textContent = 'Next golfer in ' + formatCountdown(msUntilMidnight());
  }
  tick();
  countdownInterval = setInterval(tick, 1000);
}

function stopCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = null;
  countdownLine.style.display = 'none';
}

/* ---------------- Core game logic ---------------- */

function currentPool() {
  return modeToggle.checked ? 'all' : 'current';
}

function updateHeader() {
  if (gameType === 'daily') {
    eyebrow.textContent = 'MAJOR CHAMPIONSHIP DAILY';
    dateline.textContent = new Date().toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    newRoundBtn.style.display = 'none';
  } else {
    eyebrow.textContent = 'UNLIMITED PRACTICE ROUNDS';
    dateline.textContent = 'Play as many golfers as you want';
    newRoundBtn.style.display = 'inline-block';
  }
  updateStreakBadge();
}

async function loadGolferList() {
  const res = await fetch(`/api/golfers?pool=${currentPool()}`);
  allGolfers = await res.json();
}

async function loadGame() {
  const res = await fetch(`/api/game?type=${gameType}&pool=${currentPool()}`);
  const state = await res.json();
  render(state, false);
}

function render(state, isFreshGuess) {
  renderHoles(state.hints, state.max_hints);
  renderHistory(state.guesses);

  const finished = state.finished;
  guessInput.disabled = finished;
  guessBtn.disabled = finished;
  skipBtn.disabled = finished;
  guessInput.placeholder = finished
    ? (gameType === 'daily' ? "Today's puzzle is complete" : "Round over \u2014 start a new one below")
    : "Type a golfer's name...";

  if (finished) {
    showResult(state, isFreshGuess);
  } else {
    resultOverlay.classList.remove('visible');
    viewResultBtn.style.display = 'none';
    stopCountdown();
  }
}

function renderHoles(hints, maxHints) {
  holeList.innerHTML = '';
  for (let i = 0; i < maxHints; i++) {
    const row = document.createElement('div');
    const revealed = i < hints.length;
    row.className = 'hole-row ' + (revealed ? (i === hints.length - 1 ? 'active filled' : 'filled') : 'pending');
    row.innerHTML = `
      <div class="hole-num">${i + 1}</div>
      <div class="hole-clue">${revealed ? hints[i] : ''}</div>
    `;
    holeList.appendChild(row);
  }
}

function renderHistory(guesses) {
  guessHistory.innerHTML = '';
  guesses.forEach(g => {
    const chip = document.createElement('div');
    const cls = g.skipped ? 'skipped' : (g.correct ? 'right' : 'wrong');
    chip.className = 'guess-chip ' + cls;
    chip.textContent = g.text;
    guessHistory.appendChild(chip);
  });
}

function showResult(state, isFreshGuess) {
  viewResultBtn.style.display = 'none';

  if (gameType === 'daily') {
    recordDailyResult(state);
    updateStreakBadge();
  }

  const failed = state.failed;
  stampEl.textContent = state.score_term;
  stampEl.className = 'stamp' + (failed ? ' fail' : '');
  answerLine.innerHTML = gameType === 'unlimited'
    ? `That golfer was <strong>${state.answer}</strong>`
    : `Today's golfer was <strong>${state.answer}</strong>`;

  const squares = state.guesses.map(g => g.correct ? '\u26F3' : '\u2B1C').join('');
  shareGrid.textContent = squares || '\u2B1C';

  shareBtn.onclick = () => {
    const text = `Schefflerdle \u2013 ${state.score_term}\n${squares}`;
    navigator.clipboard.writeText(text).then(() => {
      shareBtn.textContent = 'Copied!';
      setTimeout(() => shareBtn.textContent = 'Copy result', 1500);
    });
  };

  if (gameType === 'daily') {
    startCountdown();
  } else {
    stopCountdown();
  }

  // Small delay before the fade-in, so the last hole fills in first,
  // same beat as Wordle's win-modal reveal.
  setTimeout(() => {
    resultOverlay.classList.add('visible');
    if (isFreshGuess) {
      if (state.solved) {
        playCorrectSound();
        launchConfetti();
      } else if (state.failed) {
        playWrongSound();
      }
    }
  }, 350);
}

function closeResult() {
  resultOverlay.classList.remove('visible');
  viewResultBtn.style.display = 'inline-block';
}

closeResultBtn.addEventListener('click', closeResult);
resultOverlay.addEventListener('click', (e) => {
  if (e.target === resultOverlay) closeResult();
});
viewResultBtn.addEventListener('click', () => {
  resultOverlay.classList.add('visible');
  viewResultBtn.style.display = 'none';
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (resultOverlay.classList.contains('visible')) closeResult();
    if (helpOverlay.classList.contains('visible')) helpOverlay.classList.remove('visible');
    if (statsOverlay.classList.contains('visible')) statsOverlay.classList.remove('visible');
  }
});

function renderSuggestions(matches) {
  suggestionsEl.innerHTML = '';
  highlightedIndex = -1;
  if (matches.length === 0) {
    suggestionsEl.classList.remove('open');
    return;
  }
  matches.slice(0, 8).forEach(m => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.textContent = m.name;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      guessInput.value = m.name;
      suggestionsEl.classList.remove('open');
      submitGuess();
    });
    suggestionsEl.appendChild(item);
  });
  suggestionsEl.classList.add('open');
}

guessInput.addEventListener('input', () => {
  const q = guessInput.value.trim().toLowerCase();
  if (!q) {
    suggestionsEl.classList.remove('open');
    return;
  }
  const matches = allGolfers.filter(g => g.name.toLowerCase().includes(q));
  renderSuggestions(matches);
});

guessInput.addEventListener('keydown', (e) => {
  const items = Array.from(suggestionsEl.querySelectorAll('.suggestion-item'));
  if (e.key === 'ArrowDown' && items.length) {
    e.preventDefault();
    highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
    items.forEach((it, i) => it.classList.toggle('highlighted', i === highlightedIndex));
  } else if (e.key === 'ArrowUp' && items.length) {
    e.preventDefault();
    highlightedIndex = Math.max(highlightedIndex - 1, 0);
    items.forEach((it, i) => it.classList.toggle('highlighted', i === highlightedIndex));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (highlightedIndex >= 0 && items[highlightedIndex]) {
      guessInput.value = items[highlightedIndex].textContent;
    }
    suggestionsEl.classList.remove('open');
    submitGuess();
  } else if (e.key === 'Escape') {
    suggestionsEl.classList.remove('open');
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.guess-input-wrap')) {
    suggestionsEl.classList.remove('open');
  }
});

guessBtn.addEventListener('click', submitGuess);
skipBtn.addEventListener('click', skipHint);

async function submitGuess() {
  const guess = guessInput.value.trim();
  if (!guess) return;
  guessBtn.disabled = true;
  try {
    const res = await fetch('/api/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: gameType, pool: currentPool(), guess })
    });
    const state = await res.json();
    guessInput.value = '';
    const lastGuess = state.guesses[state.guesses.length - 1];
    if (!state.finished && lastGuess && !lastGuess.correct) {
      playWrongSound();
    }
    render(state, true);
  } finally {
    guessBtn.disabled = false;
  }
}

async function skipHint() {
  skipBtn.disabled = true;
  try {
    const res = await fetch('/api/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: gameType, pool: currentPool() })
    });
    const state = await res.json();
    guessInput.value = '';
    render(state, true);
  } finally {
    skipBtn.disabled = false;
  }
}

modeToggle.addEventListener('change', async () => {
  await loadGolferList();
  await loadGame();
});

function setActiveTab(type) {
  gameType = type;
  dailyTab.classList.toggle('active', type === 'daily');
  unlimitedTab.classList.toggle('active', type === 'unlimited');
  updateHeader();
}

dailyTab.addEventListener('click', async () => {
  if (gameType === 'daily') return;
  setActiveTab('daily');
  await loadGame();
});

unlimitedTab.addEventListener('click', async () => {
  if (gameType === 'unlimited') return;
  setActiveTab('unlimited');
  await loadGame();
});

newRoundBtn.addEventListener('click', async () => {
  newRoundBtn.disabled = true;
  try {
    const res = await fetch('/api/new-round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pool: currentPool() })
    });
    const state = await res.json();
    guessInput.value = '';
    render(state, false);
  } finally {
    newRoundBtn.disabled = false;
  }
});

(async function init() {
  updateHeader();
  await loadGolferList();
  await loadGame();
  if (!localStorage.getItem(HELP_SEEN_KEY)) {
    setTimeout(() => helpOverlay.classList.add('visible'), 500);
  }
})();