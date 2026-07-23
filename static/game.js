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
const shareGrid = document.getElementById('shareGrid');
const shareBtn = document.getElementById('shareBtn');
const modeToggle = document.getElementById('modeToggle');
const dateline = document.getElementById('dateline');
const eyebrow = document.getElementById('eyebrow');
const dailyTab = document.getElementById('dailyTab');
const unlimitedTab = document.getElementById('unlimitedTab');
const newRoundBtn = document.getElementById('newRoundBtn');

let allGolfers = [];
let highlightedIndex = -1;
let gameType = 'daily'; // 'daily' or 'unlimited'

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
}

async function loadGolferList() {
  const res = await fetch(`/api/golfers?pool=${currentPool()}`);
  allGolfers = await res.json();
}

async function loadGame() {
  const res = await fetch(`/api/game?type=${gameType}&pool=${currentPool()}`);
  const state = await res.json();
  render(state);
}

function render(state) {
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
    showResult(state);
  } else {
    resultOverlay.classList.remove('visible');
    viewResultBtn.style.display = 'none';
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

function showResult(state) {
  viewResultBtn.style.display = 'none';
  const failed = state.failed;
  stampEl.textContent = state.score_term;
  stampEl.className = 'stamp' + (failed ? ' fail' : '');
  answerLine.innerHTML = `Today's golfer was <strong>${state.answer}</strong>`;
  if (gameType === 'unlimited') {
    answerLine.innerHTML = `That golfer was <strong>${state.answer}</strong>`;
  }

  const squares = state.guesses.map(g => g.correct ? '\u26F3' : '\u2B1C').join('');
  shareGrid.textContent = squares || '\u2B1C';

  shareBtn.onclick = () => {
    const text = `Schefflerdle \u2013 ${state.score_term}\n${squares}`;
    navigator.clipboard.writeText(text).then(() => {
      shareBtn.textContent = 'Copied!';
      setTimeout(() => shareBtn.textContent = 'Copy result', 1500);
    });
  };

  // Small delay before the fade-in, so the last hole fills in first,
  // same beat as Wordle's win-modal reveal.
  setTimeout(() => resultOverlay.classList.add('visible'), 350);
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
  if (e.key === 'Escape' && resultOverlay.classList.contains('visible')) closeResult();
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
    render(state);
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
    render(state);
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
    render(state);
  } finally {
    newRoundBtn.disabled = false;
  }
});

(async function init() {
  updateHeader();
  await loadGolferList();
  await loadGame();
})();