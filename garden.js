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
        depth: index / 363,
        type,
        weight: .25 + random() * .75,
        x: .04 + random() * .92,
        sway: random() * Math.PI * 2,
        leafCount: 1 + Math.floor(random() * 5),
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

function drawLeaf(x, y, side, scale, angle, alpha) {
  context.save();
  context.translate(x, y);
  context.rotate(side * (.5 + angle * .18));
  context.scale(side * scale, scale);
  context.globalAlpha *= alpha;
  context.fillStyle = '#5e9a69';
  context.beginPath();
  context.moveTo(0, 0);
  context.quadraticCurveTo(7, -5, 13, 0);
  context.quadraticCurveTo(7, 5, 0, 0);
  context.fill();
  context.restore();
}

function flowerPath(x, ground, height, color, phase, highlighted, progress, scale, leafCount, depth) {
  const stemHeight = height * progress;
  const top = ground - stemHeight;
  const sway = Math.sin(frame * .014 + phase) * (reducedMotion ? 0 : 2.2 * scale);
  context.lineCap = 'round';
  context.strokeStyle = highlighted ? '#285a3a' : `rgba(49, 112, 67, ${.32 + depth * .5})`;
  context.lineWidth = (highlighted ? 1.8 : .8 + depth * .65) * scale;
  context.beginPath();
  context.moveTo(x, ground);
  context.quadraticCurveTo(x - sway, ground - stemHeight * .52, x + sway, top);
  context.stroke();

  const visibleLeaves = Math.floor(leafCount * Math.min(1, progress * 1.3));
  for (let leaf = 0; leaf < visibleLeaves; leaf += 1) {
    const fraction = .22 + leaf / Math.max(1, leafCount) * .5;
    const leafY = ground - stemHeight * fraction;
    const leafX = x + sway * fraction;
    const side = leaf % 2 ? 1 : -1;
    drawLeaf(leafX, leafY, side, (.3 + depth * .28) * scale, phase + leaf, .38 + depth * .55);
  }

  if (progress < .72) return;
  const bloom = Math.min(1, (progress - .72) / .28);
  const radius = (highlighted ? 3.4 : 2.15 + depth * 1.05) * bloom * scale;
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
  const elapsed = reducedMotion ? 99999 : now - startTime;

  memories.forEach((memory, index) => {
    const highlighted = selectedDate === memory.date;
    const dimmed = selectedDate && !highlighted;
    const depth = memory.depth;
    const scale = .4 + depth * .46;
    context.save();
    context.globalAlpha = dimmed ? .055 : highlighted ? 1 : .22 + depth * .68;
    const progress = Math.min(1, Math.max(0, (elapsed - index * 3) / 850));
    const x = memory.x * width;
    const localGround = height * (.57 + depth * .3) + Math.sin(index * 1.7) * (3 + depth * 9);
    const flowerHeight = (12 + memory.weight * 40) * scale;
    flowerPath(x, localGround, flowerHeight, TYPES[memory.type].color, memory.sway,
      highlighted, progress, scale, memory.leafCount, depth);
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
