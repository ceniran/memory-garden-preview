'use strict';

const TYPES = {
  relationship: { color: '#f4a3b7', label: '关系' },
  shared: { color: '#efc85d', label: '共同经历' },
  project: { color: '#80b6df', label: '项目' },
  reflection: { color: '#b59cda', label: '反思' }
};

const canvas = document.querySelector('#garden');
const context = canvas.getContext('2d');
const calendar = document.querySelector('#calendar');
const dateLabel = document.querySelector('#date-label');
const memoryLabel = document.querySelector('#memory-label');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let seed = 20260920;
let memories = [];
let selectedDate = null;
let startTime = performance.now();
let frame = 0;

function random() {
  seed |= 0;
  seed = seed + 0x6D2B79F5 | 0;
  let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
  value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function makeMemories() {
  seed = 20260920;
  const result = [];
  const start = new Date('2025-10-27T00:00:00Z');
  for (let index = 0; index < 364; index += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const count = random() < .44 ? 0 : 1 + Math.floor(random() * (random() > .78 ? 4 : 2));
    for (let item = 0; item < count; item += 1) {
      const type = Object.keys(TYPES)[Math.floor(random() * 4)];
      result.push({
        id: `${index}-${item}`,
        date: dateKey(date),
        type,
        weight: .25 + random() * .75,
        x: .04 + random() * .92,
        sway: random() * Math.PI * 2,
        title: ['一起留下的片刻', '今天长出的新理解', '慢慢完成的一件事', '又靠近了一点'][Math.floor(random() * 4)]
      });
    }
  }
  return result;
}

function buildCalendar() {
  calendar.replaceChildren();
  const counts = new Map();
  memories.forEach(memory => counts.set(memory.date, (counts.get(memory.date) || 0) + 1));
  const start = new Date('2025-10-27T00:00:00Z');
  for (let index = 0; index < 364; index += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = dateKey(date);
    const count = counts.get(key) || 0;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'day';
    button.dataset.date = key;
    button.dataset.level = String(Math.min(4, count));
    button.style.setProperty('--order', index);
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', `${key}，${count ? `${count} 朵记忆花` : '土地休息'}`);
    button.addEventListener('click', () => selectDay(key, button));
    calendar.append(button);
  }
}

function selectDay(key, button) {
  selectedDate = selectedDate === key ? null : key;
  document.querySelectorAll('.day.is-active').forEach(day => day.classList.remove('is-active'));
  if (selectedDate) button.classList.add('is-active');
  const selected = memories.filter(memory => memory.date === selectedDate);
  dateLabel.textContent = selectedDate || '全年记忆';
  memoryLabel.textContent = selectedDate
    ? selected.length
      ? `这一天长出 ${selected.length} 朵花：${[...new Set(selected.map(item => TYPES[item.type].label))].join('、')}。`
      : '这一天没有留下花，土地只是安静地休息。'
    : '点击上方日期，看看那一天长出了什么。';
}

function resizeCanvas() {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function flowerPath(x, ground, height, color, phase, highlighted, progress) {
  const stemHeight = height * progress;
  const top = ground - stemHeight;
  const sway = Math.sin(frame * .018 + phase) * (reducedMotion ? 0 : 1.8);
  context.lineCap = 'round';
  context.strokeStyle = highlighted ? '#285a3a' : 'rgba(49, 112, 67, .68)';
  context.lineWidth = highlighted ? 1.7 : 1.05;
  context.beginPath();
  context.moveTo(x, ground);
  context.quadraticCurveTo(x - sway, ground - stemHeight * .52, x + sway, top);
  context.stroke();

  if (progress < .72) return;
  const bloom = Math.min(1, (progress - .72) / .28);
  const radius = (highlighted ? 3.9 : 2.7) * bloom;
  for (let petal = 0; petal < 5; petal += 1) {
    const angle = petal / 5 * Math.PI * 2 + phase;
    context.fillStyle = color;
    context.beginPath();
    context.arc(x + sway + Math.cos(angle) * radius, top + Math.sin(angle) * radius, radius * .76, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = '#fff2b3';
  context.beginPath();
  context.arc(x + sway, top, radius * .65, 0, Math.PI * 2);
  context.fill();
}

function draw(now) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  context.clearRect(0, 0, width, height);
  const ground = height * .86;
  const elapsed = reducedMotion ? 99999 : now - startTime;

  const mist = context.createRadialGradient(width * .5, ground, 10, width * .5, ground, width * .58);
  mist.addColorStop(0, 'rgba(125, 184, 126, .18)');
  mist.addColorStop(1, 'rgba(125, 184, 126, 0)');
  context.fillStyle = mist;
  context.fillRect(0, ground - 120, width, 160);

  memories.forEach((memory, index) => {
    const highlighted = selectedDate === memory.date;
    const dimmed = selectedDate && !highlighted;
    context.save();
    context.globalAlpha = dimmed ? .09 : highlighted ? 1 : .58;
    const progress = Math.min(1, Math.max(0, (elapsed - index * 3) / 850));
    const x = memory.x * width;
    const localGround = ground + Math.sin(index * 1.7) * 20;
    const flowerHeight = 28 + memory.weight * 96;
    flowerPath(x, localGround, flowerHeight, TYPES[memory.type].color, memory.sway, highlighted, progress);
    context.restore();
  });

  frame += 1;
  requestAnimationFrame(draw);
}

document.querySelector('#regrow').addEventListener('click', () => {
  selectedDate = null;
  document.querySelectorAll('.day.is-active').forEach(day => day.classList.remove('is-active'));
  dateLabel.textContent = '全年记忆';
  memoryLabel.textContent = '花田正在从这一年的日子里重新长出来。';
  startTime = performance.now();
});

window.addEventListener('resize', resizeCanvas);
memories = makeMemories();
buildCalendar();
resizeCanvas();
requestAnimationFrame(draw);
