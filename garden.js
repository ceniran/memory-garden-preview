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
const monthLabel = document.querySelector('#month-label');
const previousMonthButton = document.querySelector('#previous-month');
const nextMonthButton = document.querySelector('#next-month');
const monthPreview = document.querySelector('#month-preview');
const calendarDisclosure = document.querySelector('.calendar-panel.t-acc');
const calendarToggle = document.querySelector('#calendar-toggle');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let seed = 20260920;
let memories = [];
let growthEvents = [];
let grassTufts = [];
let selectedDate = null;
let startTime = performance.now();
let frame = 0;
let calendarStart = new Date('2025-10-27T00:00:00Z');
let calendarMonth = new Date();

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
    const count = random() < .52 ? 0 : 1 + Math.floor(random() * (random() > .82 ? 3 : 2));
    for (let item = 0; item < count; item += 1) {
      const type = Object.keys(TYPES)[Math.floor(random() * 4)];
      const weight = .25 + random() * .75;
      result.push({
        id: `${index}-${item}`,
        date: dateKey(date),
        dayIndex: index,
        depth: (weight - .25) / .75,
        type,
        flowerStyle: (index * 7 + item * 11) % 3,
        weight,
        x: .04 + random() * .92,
        sway: random() * Math.PI * 2,
        leafCount: Math.floor(random() * 3),
        title: ['一起留下的片刻', '今天长出的新理解', '慢慢完成的一件事', '又靠近了一点'][Math.floor(random() * 4)]
      });
    }
  }
  const sorted = result.sort((a, b) => a.weight - b.weight);
  sorted.forEach(memory => {
    const neighbors = sorted.filter(candidate =>
      Math.abs(candidate.x - memory.x) < .075 && Math.abs(candidate.depth - memory.depth) < .085
    ).length - 1;
    memory.density = Math.min(1, neighbors / 8);
  });
  return sorted;
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRealMemories(items) {
  const dated = items
    .map(item => ({ ...item, timestamp: Date.parse(item.occurred_at || '') }))
    .filter(item => item.id && Number.isFinite(item.timestamp));
  const latest = dated.reduce((value, item) => Math.max(value, item.timestamp), Date.now());
  const end = new Date(latest);
  end.setUTCHours(0, 0, 0, 0);
  calendarStart = new Date(end);
  calendarStart.setUTCDate(calendarStart.getUTCDate() - 363);
  calendarMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const startTimeValue = calendarStart.getTime();
  const result = dated
    .map(item => {
      const idSeed = hashText(item.id);
      const weight = Math.min(1, Math.max(0, Number(item.weight) || .5));
      const dayIndex = Math.floor((new Date(item.timestamp).setUTCHours(0, 0, 0, 0) - startTimeValue) / 86400000);
      return {
        id: item.id,
        date: dateKey(new Date(item.timestamp)),
        dayIndex,
        depth: weight,
        type: TYPES[item.visual_type] ? item.visual_type : 'shared',
        flowerStyle: idSeed % 3,
        weight,
        x: .04 + ((idSeed % 10007) / 10006) * .92,
        sway: ((idSeed >>> 8) % 6283) / 1000,
        leafCount: (idSeed >>> 16) % 3,
        title: String(item.title || '一段记忆').slice(0, 160)
      };
    })
    .filter(memory => memory.dayIndex >= 0 && memory.dayIndex < 364)
    .sort((a, b) => a.weight - b.weight);
  result.forEach(memory => {
    const neighbors = result.filter(candidate =>
      Math.abs(candidate.x - memory.x) < .075 && Math.abs(candidate.depth - memory.depth) < .085
    ).length - 1;
    memory.density = Math.min(1, neighbors / 8);
  });
  return result;
}

function makeGrassTufts() {
  return memories
    .filter((memory, index) => {
      const chance = ((memory.dayIndex * 37 + index * 17) % 101) / 100;
      return chance < .025 + memory.density * .14;
    })
    .slice(0, 36)
    .map((memory, index) => ({
      x: Math.max(.03, Math.min(.97, memory.x + (((index * 29) % 9) - 4) * .003)),
      depth: memory.depth,
      density: memory.density,
      memory,
      blades: 2 + Math.round(memory.density * 2),
      phase: index * .83
    }));
}

function makeGrowthEvents(items) {
  const fullGarden = items.length > 10;
  return items.map((memory, order) => ({
    memory,
    delay: fullGarden
      ? 140 + ((memory.dayIndex * 97 + order * 53) % 997) / 996 * 5200
      : 140 + order * 260,
    gravity: .00072 + (order % 4) * .00005,
    drift: ((order % 3) - 1) * 5
  }));
}

function startGrowth(items) {
  growthEvents = makeGrowthEvents(items);
  startTime = performance.now();
}

function buildCalendar() {
  calendar.replaceChildren();
  const counts = new Map();
  memories.forEach(memory => counts.set(memory.date, (counts.get(memory.date) || 0) + 1));
  const year = calendarMonth.getUTCFullYear();
  const month = calendarMonth.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const leading = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - leading);
  monthLabel.textContent = `${year}年${month + 1}月`;
  monthPreview.replaceChildren();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dateKey(new Date(Date.UTC(year, month, day)));
    const mark = document.createElement('i');
    mark.dataset.date = key;
    mark.dataset.level = String(Math.min(4, counts.get(key) || 0));
    mark.setAttribute('aria-label', `${key}，${counts.get(key) || 0} 朵记忆花`);
    monthPreview.append(mark);
  }
  calendar.classList.remove('is-changing');
  void calendar.offsetWidth;
  calendar.classList.add('is-changing');
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const key = dateKey(date);
    const count = counts.get(key) || 0;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'day';
    button.dataset.date = key;
    button.dataset.level = String(Math.min(4, count));
    button.dataset.outside = date.getUTCMonth() === month ? 'false' : 'true';
    button.style.setProperty('--order', index);
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', `${key}，${count ? `${count} 朵记忆花` : '土地休息'}`);
    const dayNumber = document.createElement('span');
    dayNumber.textContent = String(date.getUTCDate());
    button.append(dayNumber);
    if (count) {
      const flowerCount = document.createElement('small');
      flowerCount.textContent = String(count);
      button.append(flowerCount);
    }
    button.addEventListener('click', () => {
      if (date.getUTCMonth() !== month) {
        calendarMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
        buildCalendar();
        selectDay(key, calendar.querySelector(`[data-date="${key}"]`));
        return;
      }
      selectDay(key, button);
    });
    calendar.append(button);
  }
}

function changeMonth(offset) {
  calendarMonth = new Date(Date.UTC(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth() + offset, 1));
  buildCalendar();
}

function selectDay(key, button) {
  selectedDate = selectedDate === key ? null : key;
  document.querySelectorAll('.day.is-active').forEach(day => day.classList.remove('is-active'));
  if (selectedDate) button.classList.add('is-active');
  const selected = memories.filter(memory => memory.date === selectedDate);
  startGrowth(selectedDate ? selected : memories);
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

function drawGrass(width, height, elapsed) {
  context.save();
  context.lineCap = 'round';
  grassTufts.forEach(tuft => {
    const flowerProgress = growthProgress(tuft.memory, height, elapsed);
    const grassProgress = Math.min(1, Math.max(0, (flowerProgress - .58) / .42));
    if (!grassProgress) return;
    const ground = height * (.57 + tuft.depth * .3);
    const breeze = reducedMotion ? 0 : Math.sin(frame * .011 + tuft.phase) * (.45 + tuft.depth * .5);
    const densityAlpha = .48 + tuft.density * .52;
    context.strokeStyle = `rgba(55, 117, 68, ${grassProgress * densityAlpha * (.13 + tuft.depth * .27)})`;
    context.fillStyle = `rgba(69, 132, 76, ${grassProgress * densityAlpha * (.11 + tuft.depth * .22)})`;
    context.lineWidth = .48 + tuft.depth * .32;
    for (let blade = 0; blade < tuft.blades; blade += 1) {
      const centered = blade - (tuft.blades - 1) / 2;
      const offset = centered * 1.35 + Math.sin(tuft.phase + blade) * .8;
      const lean = centered * 2.7 + Math.sin(tuft.phase * 1.7 + blade) * 1.8 + breeze;
      const bladeHeight = (3.5 + tuft.depth * 6 + (blade % 2) * 1.6) * grassProgress;
      const baseX = tuft.x * width + offset;
      const tipX = baseX + lean;
      const tipY = ground - bladeHeight;
      context.beginPath();
      context.moveTo(baseX, ground + Math.abs(centered) * .35);
      context.quadraticCurveTo(baseX + lean * .28, ground - bladeHeight * .48, tipX, tipY);
      context.stroke();
      if (blade === 0 && tuft.blades > 2) {
        context.save();
        context.translate(baseX + lean * .48, ground - bladeHeight * .48);
        context.rotate(-.45 + lean * .04);
        context.beginPath();
        context.scale(grassProgress, grassProgress);
        context.ellipse(0, 0, 1.9 + tuft.depth, .65 + tuft.depth * .25, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
    }
  });
  context.restore();
}

function drawRoundBloom(x, y, radius, color, phase) {
  for (let petal = 0; petal < 5; petal += 1) {
    const angle = petal / 5 * Math.PI * 2 + phase;
    context.fillStyle = color;
    context.beginPath();
    context.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, radius * .76, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = '#fff2b3';
  context.beginPath();
  context.arc(x, y, radius * .65, 0, Math.PI * 2);
  context.fill();
}

function drawBezierBloom(x, y, radius, color, phase) {
  context.save();
  context.translate(x, y);
  for (let petal = 0; petal < 6; petal += 1) {
    context.save();
    context.rotate(petal / 6 * Math.PI * 2 + phase);
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, radius * .18);
    context.bezierCurveTo(-radius * .65, -radius * .1, -radius * .72, -radius * 1.55, 0, -radius * 2.05);
    context.bezierCurveTo(radius * .72, -radius * 1.48, radius * .62, -radius * .18, 0, radius * .18);
    context.fill();
    context.restore();
  }
  context.fillStyle = '#f8e18d';
  context.beginPath();
  context.arc(0, 0, radius * .56, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBellBloom(x, y, radius, color, phase) {
  const tilt = Math.sin(phase) * radius * .28;
  context.save();
  context.translate(x + tilt, y - radius * .18);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(-radius * .46, 0);
  context.bezierCurveTo(-radius * .55, radius * .48, -radius * .84, radius * 1.02, -radius, radius * 1.28);
  context.quadraticCurveTo(-radius * .78, radius * 1.58, -radius * .48, radius * 1.34);
  context.quadraticCurveTo(-radius * .22, radius * 1.68, 0, radius * 1.38);
  context.quadraticCurveTo(radius * .22, radius * 1.68, radius * .48, radius * 1.34);
  context.quadraticCurveTo(radius * .78, radius * 1.58, radius, radius * 1.28);
  context.bezierCurveTo(radius * .84, radius * 1.02, radius * .55, radius * .48, radius * .46, 0);
  context.closePath();
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,.28)';
  context.lineWidth = Math.max(.45, radius * .12);
  context.beginPath();
  context.moveTo(0, radius * .28);
  context.quadraticCurveTo(-radius * .08, radius * .82, 0, radius * 1.28);
  context.stroke();
  context.strokeStyle = '#f6dfa0';
  context.lineWidth = Math.max(.45, radius * .1);
  context.beginPath();
  context.moveTo(0, radius * 1.18);
  context.lineTo(0, radius * 1.72);
  context.stroke();
  context.fillStyle = '#fff0a8';
  context.beginPath();
  context.arc(0, radius * 1.76, radius * .18, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function flowerPath(x, ground, height, color, phase, highlighted, progress, scale, leafCount, depth, flowerStyle) {
  if (progress <= .015) return;
  const stemHeight = height * progress;
  const top = ground - stemHeight;
  const sway = Math.sin(frame * .014 + phase) * (reducedMotion ? 0 : 2.2 * scale);
  context.lineCap = 'round';
  context.strokeStyle = highlighted ? '#285a3a' : `rgba(49, 112, 67, ${.32 + depth * .5})`;
  context.lineWidth = (highlighted ? 2 : .9 + depth * .7) * scale;
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
  const radius = (highlighted ? 5.7 : 3.35 + depth * 1.3) * bloom * scale;
  if (flowerStyle === 0) drawRoundBloom(x + sway, top, radius, color, phase);
  if (flowerStyle === 1) drawBezierBloom(x + sway, top, radius * .72, color, phase);
  if (flowerStyle === 2) drawBellBloom(x + sway, top, radius * .9, color, phase);
}

function drawLocalHaze(width, height, elapsed) {
  for (let index = 0; index < memories.length; index += 4) {
    const memory = memories[index];
    const depth = memory.depth;
    const progress = growthProgress(memory, height, elapsed);
    const hazeProgress = Math.min(1, Math.max(0, (progress - .58) / .42));
    if (!hazeProgress) continue;
    const dimmed = selectedDate && memory.date !== selectedDate;
    const x = memory.x * width;
    const y = flowerGround(memory, height);
    const densityScale = .62 + memory.density * .58;
    const patchWidth = (24 + depth * 48) * densityScale * (.72 + hazeProgress * .28);
    const patchHeight = (7 + depth * 12) * densityScale * (.72 + hazeProgress * .28);
    context.save();
    context.globalAlpha = hazeProgress * (.38 + memory.density * .72) * (dimmed ? .08 : 1);
    context.translate(x, y);
    context.scale(patchWidth, patchHeight);
    const haze = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    haze.addColorStop(0, `rgba(92, 174, 109, ${.2 + depth * .09})`);
    haze.addColorStop(.48, `rgba(119, 191, 130, ${.12 + depth * .07})`);
    haze.addColorStop(1, 'rgba(151, 207, 157, 0)');
    context.fillStyle = haze;
    context.beginPath();
    context.arc(0, 0, 1, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function flowerGround(memory, height) {
  return height * (.57 + memory.depth * .3) + Math.sin(memory.sway * 2.1) * (3 + memory.depth * 9);
}

function drawRipple(x, ground, age) {
  if (age < 0 || age > 460) return;
  const progress = age / 460;
  context.save();
  context.globalAlpha = (1 - progress) * .32;
  context.strokeStyle = '#4f9870';
  context.lineWidth = 1.2;
  context.beginPath();
  context.ellipse(x, ground + 1, 3 + progress * 16, 1 + progress * 4, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function eventTiming(event, ground) {
  const distance = Math.max(1, ground + 30);
  const fallDuration = Math.sqrt(2 * distance / event.gravity);
  return { fallDuration, landing: event.delay + fallDuration };
}

function drawGrowthRain(width, height, elapsed) {
  const falling = [];
  context.save();
  context.lineCap = 'round';
  growthEvents.forEach(event => {
    const ground = flowerGround(event.memory, height);
    const timing = eventTiming(event, ground);
    const age = elapsed - event.delay;
    if (age < 0 || age >= timing.fallDuration) {
      drawRipple(event.memory.x * width, ground, elapsed - timing.landing);
      return;
    }
    falling.push(event);
    const x = event.memory.x * width + event.drift * (1 - age / timing.fallDuration);
    const y = -30 + .5 * event.gravity * age * age;
    const speed = event.gravity * age;
    context.globalAlpha = .2 + Math.min(.42, speed * 120);
    context.strokeStyle = '#3f8760';
    context.lineWidth = 1.1;
    context.beginPath();
    context.moveTo(x, y - 4 - speed * 10);
    context.lineTo(x, y + 5);
    context.stroke();
  });
  context.restore();
  const rainingDate = falling.sort((a, b) => b.delay - a.delay)[0]?.memory.date || null;
  document.querySelectorAll('.day.is-raining').forEach(day => day.classList.remove('is-raining'));
  document.querySelectorAll('.month-preview i.is-raining').forEach(day => day.classList.remove('is-raining'));
  if (rainingDate) document.querySelector(`.day[data-date="${rainingDate}"]`)?.classList.add('is-raining');
  if (rainingDate) document.querySelector(`.month-preview i[data-date="${rainingDate}"]`)?.classList.add('is-raining');
}

function growthProgress(memory, height, elapsed) {
  if (reducedMotion) return 1;
  const event = growthEvents.find(item => item.memory === memory);
  if (!event) return 1;
  const { landing } = eventTiming(event, flowerGround(memory, height));
  const raw = Math.min(1, Math.max(0, (elapsed - landing) / 1050));
  return raw * raw * (3 - 2 * raw);
}

function draw(now) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  context.clearRect(0, 0, width, height);
  const elapsed = reducedMotion ? 99999 : now - startTime;

  if (!reducedMotion) drawGrowthRain(width, height, elapsed);
  drawLocalHaze(width, height, elapsed);
  drawGrass(width, height, elapsed);

  memories.forEach((memory, index) => {
    const highlighted = selectedDate === memory.date;
    const dimmed = selectedDate && !highlighted;
    const depth = memory.depth;
    const scale = .48 + depth * .48;
    context.save();
    context.globalAlpha = dimmed ? .055 : highlighted ? 1 : .22 + depth * .68;
    const x = memory.x * width;
    const localGround = flowerGround(memory, height);
    const progress = growthProgress(memory, height, elapsed);
    const flowerHeight = (7 + memory.weight * 17) * scale;
    flowerPath(x, localGround, flowerHeight, TYPES[memory.type].color, memory.sway,
      highlighted, progress, scale, memory.leafCount, depth, memory.flowerStyle);
    context.restore();
  });

  frame += 1;
  requestAnimationFrame(draw);
}

document.querySelector('#regrow').addEventListener('click', () => {
  selectedDate = null;
  document.querySelectorAll('.day.is-active').forEach(day => day.classList.remove('is-active'));
  dateLabel.textContent = '全年记忆';
  memoryLabel.textContent = '雨正错落落进花田；落在哪里，哪里的记忆花就开始生长。';
  startGrowth(memories);
});
previousMonthButton.addEventListener('click', () => changeMonth(-1));
nextMonthButton.addEventListener('click', () => changeMonth(1));
calendarToggle.addEventListener('click', () => {
  const open = calendarDisclosure.getAttribute('data-open') === 'true';
  calendarDisclosure.setAttribute('data-open', String(!open));
  calendarToggle.setAttribute('aria-expanded', String(!open));
  calendarToggle.querySelector('small').textContent = open ? '点击展开月历' : '点击收起月历';
});

async function initialize() {
  const endpoint = document.querySelector('meta[name="garden-data-source"]')?.content;
  const allowSynthetic = document.querySelector('meta[name="garden-allow-synthetic"]')?.content !== 'false';
  try {
    if (!endpoint) throw new Error('no_real_data_endpoint');
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    if (!response.ok) throw new Error(`garden_data_${response.status}`);
    const payload = await response.json();
    memories = makeRealMemories(Array.isArray(payload.memories) ? payload.memories : []);
    memoryLabel.textContent = memories.length
      ? `已从只读记忆接口长出 ${memories.length} 朵花。点击日期查看当天的记忆。`
      : '真实记忆已经接通，只是这一年还没有可显示的花。';
  } catch (error) {
    if (!allowSynthetic) {
      memories = [];
      memoryLabel.textContent = '真实记忆暂时没有接通；花田没有使用演示数据代替。';
      console.error(error);
    } else {
      memories = makeMemories();
      const latest = memories.reduce((value, memory) => memory.date > value ? memory.date : value, '');
      const latestDate = new Date(`${latest}T00:00:00Z`);
      calendarMonth = new Date(Date.UTC(latestDate.getUTCFullYear(), latestDate.getUTCMonth(), 1));
    }
  }
  grassTufts = makeGrassTufts();
  buildCalendar();
  resizeCanvas();
  startGrowth(memories);
  requestAnimationFrame(draw);
}

window.addEventListener('resize', resizeCanvas);
initialize();
