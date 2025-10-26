const envelope = document.getElementById('envelope');
const result = document.getElementById('result');
const resetBtn = document.getElementById('reset');

const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 200;
const ANIMATION_DURATION = 900;

const formatAmount = (value) => value.toFixed(2);

const generateAmount = () => {
  const amount = Math.random() * (MAX_AMOUNT - MIN_AMOUNT) + MIN_AMOUNT;
  return Math.min(amount, MAX_AMOUNT);
};

let isAnimating = false;

const openEnvelope = () => {
  if (isAnimating) return;
  isAnimating = true;
  result.classList.remove('show');
  result.textContent = '';
  envelope.classList.add('open');
  setTimeout(() => {
    const amount = formatAmount(generateAmount());
    result.textContent = `恭喜获得 ¥${amount}`;
    result.classList.add('show');
    isAnimating = false;
  }, ANIMATION_DURATION);
};

const resetEnvelope = () => {
  if (isAnimating) return;
  envelope.classList.remove('open');
  result.classList.remove('show');
  result.textContent = '';
};

envelope.addEventListener('click', openEnvelope);
envelope.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openEnvelope();
  }
});

envelope.setAttribute('tabindex', '0');

resetBtn.addEventListener('click', resetEnvelope);
