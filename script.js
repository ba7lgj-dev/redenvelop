const form = document.getElementById('configForm');
const totalAmountInput = document.getElementById('totalAmount');
const peopleCountInput = document.getElementById('peopleCount');
const styleSelect = document.getElementById('styleSelect');
const styleNameEl = document.getElementById('styleName');
const envelope = document.getElementById('envelope');
const envelopeSeal = document.getElementById('envelopeSeal');
const grabBtn = document.getElementById('grabBtn');
const stageHint = document.getElementById('stageHint');
const payoutAmountEl = document.getElementById('payoutAmount');
const payoutNoteEl = document.getElementById('payoutNote');
const chatLog = document.getElementById('chatLog');
const historyList = document.getElementById('historyList');
const totalMoneyEl = document.getElementById('totalMoney');
const totalCountEl = document.getElementById('totalCount');
const remainingCountEl = document.getElementById('remainingCount');
const remainingMoneyEl = document.getElementById('remainingMoney');
const bestAmountEl = document.getElementById('bestAmount');
const worstAmountEl = document.getElementById('worstAmount');

const STYLE_CONFIG = {
  classic: { label: '经典福运', seal: '福', className: 'envelope-3d--classic' },
  royal: { label: '锦绣尊贵', seal: '禄', className: 'envelope-3d--royal' },
  spring: { label: '春日花火', seal: '春', className: 'envelope-3d--spring' },
  cyber: { label: '赛博霓虹', seal: '喜', className: 'envelope-3d--cyber' },
  jade: { label: '玉润盈彩', seal: '瑞', className: 'envelope-3d--jade' }
};

const ANIMATION_DURATION = 1100;

let distribution = [];
let remainingCents = 0;
let totalCents = 0;
let grabbedThisRound = [];
let bestAmount = null;
let worstAmount = null;
let isAnimating = false;
let audioCtx;

const ensureAudioContext = () => {
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    const Context = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Context();
  }
  if (audioCtx?.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
};

const playToneSequence = (notes) => {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  notes.forEach(({ start = 0, duration = 0.25, freq = 440, volume = 0.2, type = 'sine' }) => {
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    const begin = now + start;
    gain.gain.setValueAtTime(0.0001, begin);
    gain.gain.exponentialRampToValueAtTime(volume, begin + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, begin + duration);
    oscillator.start(begin);
    oscillator.stop(begin + duration + 0.05);
  });
};

const playGrabSound = () => {
  playToneSequence([
    { start: 0, duration: 0.2, freq: 620, volume: 0.25, type: 'triangle' },
    { start: 0.15, duration: 0.24, freq: 780, volume: 0.2, type: 'sine' }
  ]);
};

const playRevealSound = () => {
  playToneSequence([
    { start: 0, duration: 0.18, freq: 520, volume: 0.22, type: 'triangle' },
    { start: 0.12, duration: 0.2, freq: 680, volume: 0.18, type: 'square' },
    { start: 0.26, duration: 0.4, freq: 920, volume: 0.16, type: 'sine' }
  ]);
};

const speakAmount = (amount) => {
  if (!('speechSynthesis' in window)) return;
  const value = amount.toFixed(2);
  const utterance = new SpeechSynthesisUtterance(`抢到${value}元`);
  utterance.lang = 'zh-CN';
  utterance.rate = 1.05;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
};

const formatAmount = (value) => `¥${value.toFixed(2)}`;

const addChatMessage = (type, text) => {
  const message = document.createElement('div');
  message.className = `message message--${type}`;
  message.textContent = text;
  const time = document.createElement('time');
  time.dateTime = new Date().toISOString();
  time.textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  message.appendChild(time);
  chatLog.appendChild(message);
  while (chatLog.children.length > 60) {
    chatLog.removeChild(chatLog.firstElementChild);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
};

const addHistoryItem = (amount) => {
  const item = document.createElement('li');
  item.className = 'history-item';
  const time = document.createElement('time');
  const now = new Date();
  time.dateTime = now.toISOString();
  time.textContent = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const value = document.createElement('span');
  value.className = 'amount';
  value.textContent = formatAmount(amount);
  item.append(time, value);
  historyList.prepend(item);
  const limit = 50;
  while (historyList.children.length > limit) {
    historyList.removeChild(historyList.lastElementChild);
  }
};

const updateMetrics = () => {
  totalMoneyEl.textContent = formatAmount(totalCents / 100);
  totalCountEl.textContent = grabbedThisRound.length + distribution.length;
  remainingCountEl.textContent = distribution.length;
  remainingMoneyEl.textContent = formatAmount(remainingCents / 100);
  bestAmountEl.textContent = bestAmount == null ? '--' : formatAmount(bestAmount);
  worstAmountEl.textContent = worstAmount == null ? '--' : formatAmount(worstAmount);
};

const resetEnvelopeAnimation = () => {
  envelope.classList.remove('open');
  void envelope.offsetWidth;
};

const generateDistribution = (total, count) => {
  const totalInCents = Math.round(total * 100);
  const minPerPerson = 1;
  if (totalInCents < count * minPerPerson) {
    throw new Error('金额不足以分配给所有人');
  }
  const amounts = [];
  let remaining = totalInCents;
  let peopleLeft = count;
  for (let i = 0; i < count - 1; i++) {
    const max = Math.min(
      Math.floor((remaining / peopleLeft) * 2),
      remaining - (peopleLeft - 1) * minPerPerson
    );
    const min = minPerPerson;
    const cents = Math.floor(Math.random() * (max - min + 1)) + min;
    amounts.push(cents / 100);
    remaining -= cents;
    peopleLeft -= 1;
  }
  amounts.push(remaining / 100);
  for (let i = amounts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [amounts[i], amounts[j]] = [amounts[j], amounts[i]];
  }
  return amounts;
};

const setEnvelopeStyle = (key) => {
  Object.values(STYLE_CONFIG).forEach(({ className }) => {
    envelope.classList.remove(className);
  });
  const style = STYLE_CONFIG[key] || STYLE_CONFIG.classic;
  envelope.classList.add(style.className);
  envelopeSeal.textContent = style.seal;
  styleNameEl.textContent = style.label;
};

const prepareGrab = () => {
  const disabled = distribution.length === 0;
  grabBtn.disabled = disabled;
  envelope.setAttribute('aria-disabled', String(disabled));
  if (distribution.length) {
    stageHint.textContent = `还有 ${distribution.length} 个红包等待领取！`;
    envelope.setAttribute('aria-label', `点击抢红包，剩余 ${distribution.length} 个`);
  } else if (grabbedThisRound.length) {
    stageHint.textContent = '本轮红包已抢完，点击“发红包”再来一轮。';
    envelope.setAttribute('aria-label', '本轮红包已全部领取，点击“发红包”开始新一轮');
  } else {
    stageHint.textContent = '请先设定金额和人数后点击“发红包”。';
    envelope.setAttribute('aria-label', '点击“发红包”生成红包后即可抢');
  }
};

const startNewRound = (total, count, styleKey) => {
  distribution = generateDistribution(total, count);
  totalCents = Math.round(total * 100);
  remainingCents = totalCents;
  grabbedThisRound = [];
  bestAmount = null;
  worstAmount = null;
  updateMetrics();
  const chosenKey = styleKey === 'random'
    ? Object.keys(STYLE_CONFIG)[Math.floor(Math.random() * Object.keys(STYLE_CONFIG).length)]
    : styleKey;
  setEnvelopeStyle(chosenKey);
  addChatMessage('system', `群主发出了 ${count} 个红包，共 ${formatAmount(totalCents / 100)}！`);
  prepareGrab();
  payoutAmountEl.textContent = '¥0.00';
  payoutNoteEl.textContent = '红包等你来抢';
};

const handleReveal = () => {
  if (distribution.length === 0 || isAnimating) {
    if (distribution.length === 0) {
      addChatMessage('system', '红包已经被抢完啦，快去感谢群主！');
    }
    return;
  }
  ensureAudioContext();
  playGrabSound();
  isAnimating = true;
  const amount = distribution.shift();
  const amountInCents = Math.round(amount * 100);
  remainingCents -= amountInCents;
  const willBeBest = bestAmount == null || amount > bestAmount;
  const willBeWorst = worstAmount == null || amount < worstAmount;
  grabbedThisRound.push(amount);
  if (willBeBest) bestAmount = amount;
  if (willBeWorst) worstAmount = amount;
  updateMetrics();
  resetEnvelopeAnimation();
  requestAnimationFrame(() => {
    envelope.classList.add('open');
  });
  payoutAmountEl.textContent = formatAmount(amount);
  payoutNoteEl.textContent = willBeBest
    ? '手气最佳！'
    : willBeWorst
      ? '下次继续加油～'
      : '好运正在延续';
  envelope.setAttribute('aria-label', `红包已打开，获得 ${formatAmount(amount)}`);
  setTimeout(() => {
    playRevealSound();
    speakAmount(amount);
    addChatMessage('self', `我抢到了 ${formatAmount(amount)}！`);
    addHistoryItem(amount);
    if (distribution.length === 0) {
      addChatMessage('system', '本轮红包抢完，等待下一轮惊喜。');
    }
    prepareGrab();
    isAnimating = false;
  }, ANIMATION_DURATION);
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const total = Number.parseFloat(totalAmountInput.value);
  const count = Number.parseInt(peopleCountInput.value, 10);
  if (Number.isNaN(total) || Number.isNaN(count) || total <= 0 || count <= 0) {
    addChatMessage('system', '请输入有效的金额和人数。');
    return;
  }
  if (total < count * 0.01) {
    addChatMessage('system', '金额太少啦，无法保证每人至少 0.01 元。');
    return;
  }
  ensureAudioContext();
  startNewRound(total, count, styleSelect.value);
});

grabBtn.addEventListener('click', () => {
  handleReveal();
});

envelope.addEventListener('click', () => {
  if (!grabBtn.disabled) {
    handleReveal();
  }
});

envelope.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (!grabBtn.disabled) {
      handleReveal();
    }
  }
});

stageHint.textContent = '请先设定金额和人数后点击“发红包”。';
addChatMessage('system', '设置金额与人数后点击“发红包”，开始抢红包之旅。');
