'use strict';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const palettes = {
  spring: { sky: ['#fbfcf7', '#e8f3e9'], grass: '#79aa7d', fog: '145, 203, 164' },
  summer: { sky: ['#f8fbf3', '#dcefdc'], grass: '#4f9561', fog: '104, 185, 125' },
  autumn: { sky: ['#faf9ef', '#e7ebc9'], grass: '#7f9858', grassAlt: '#b59a4f', fog: '174, 181, 102' },
  winter: { sky: ['#f8fafb', '#dfe8ec'], grass: '#81969a', fog: '195, 214, 221' }
};
const flowerColors = ['#ef9fb4', '#e9bd56', '#78add4', '#ad95d2'];

function seeded(index) {
  const value = Math.sin(index * 9187.17 + 4.13) * 43758.5453;
  return value - Math.floor(value);
}

function makeFlowers() {
  return Array.from({ length: 34 }, (_, index) => {
    const depth = .12 + seeded(index + 2) * .84;
    return {
      x: .06 + seeded(index + 31) * .88,
      depth,
      color: flowerColors[index % flowerColors.length],
      scale: .6 + depth * .65,
      style: index % 3,
      phase: seeded(index + 77) * Math.PI * 2,
      snow: .28 + seeded(index + 93) * .58
    };
  }).sort((a, b) => a.depth - b.depth);
}

function makeSnow() {
  return Array.from({ length: 48 }, (_, index) => ({
    x: seeded(index + 130),
    y: seeded(index + 180),
    size: .7 + seeded(index + 220) * 2.1,
    speed: .018 + seeded(index + 260) * .032,
    drift: (seeded(index + 300) - .5) * .05,
    phase: seeded(index + 340) * Math.PI * 2
  }));
}

const flowers = makeFlowers();
const scenes = [...document.querySelectorAll('canvas[data-season]')].map(canvas => ({
  canvas,
  context: canvas.getContext('2d'),
  season: canvas.dataset.season,
  snow: makeSnow()
}));

function fit(scene) {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const rect = scene.canvas.getBoundingClientRect();
  scene.canvas.width = Math.round(rect.width * ratio);
  scene.canvas.height = Math.round(rect.height * ratio);
  scene.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  scene.width = rect.width;
  scene.height = rect.height;
}

function bloom(context, flower, x, y, radius, snowCover) {
  context.save();
  context.translate(x, y);
  context.rotate(Math.sin(flower.phase) * .08);
  const petals = flower.style === 1 ? 6 : 5;
  for (let petal = 0; petal < petals; petal += 1) {
    const angle = petal / petals * Math.PI * 2 + flower.phase;
    const petalX = Math.cos(angle) * radius * .82;
    const petalY = Math.sin(angle) * radius * .68;
    context.fillStyle = flower.color;
    context.beginPath();
    context.ellipse(petalX, petalY, radius * .72, radius * .48, angle, 0, Math.PI * 2);
    context.fill();
    if (snowCover > 0 && Math.sin(angle) < .28) {
      context.save();
      context.globalAlpha = .62 + snowCover * .38;
      context.fillStyle = '#fff';
      context.shadowColor = 'rgba(210, 227, 234, .75)';
      context.shadowBlur = radius * .38;
      context.beginPath();
      context.ellipse(
        petalX + Math.cos(angle) * radius * .16,
        petalY + Math.sin(angle) * radius * .16 - radius * .08,
        radius * (.46 + snowCover * .08),
        radius * (.2 + snowCover * .05),
        angle,
        0,
        Math.PI * 2
      );
      context.fill();
      context.restore();
    }
  }
  context.fillStyle = '#f4dda0';
  context.beginPath();
  context.arc(0, 0, radius * .42, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawScene(scene, time) {
  const { context, width, height, season } = scene;
  if (!width || !height) return;
  const palette = palettes[season];
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, palette.sky[0]);
  gradient.addColorStop(1, palette.sky[1]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  flowers.forEach((flower, index) => {
    const x = flower.x * width;
    const ground = height * (.54 + flower.depth * .37);
    const stemHeight = (20 + flower.depth * 34) * flower.scale;
    const sway = reducedMotion ? 0 : Math.sin(time * .00045 + flower.phase) * (1 + flower.depth);
    const seasonScale = season === 'spring' ? .82 : season === 'winter' ? .88 : 1;
    const radius = (3.8 + flower.depth * 3.4) * flower.scale * seasonScale;

    context.strokeStyle = season === 'autumn' && index % 3 === 0 ? palette.grassAlt : palette.grass;
    context.globalAlpha = .42 + flower.depth * .38;
    context.lineWidth = .8 + flower.depth * .55;
    context.beginPath();
    context.moveTo(x, ground);
    context.quadraticCurveTo(x + sway * .25, ground - stemHeight * .48, x + sway, ground - stemHeight);
    context.stroke();
    context.globalAlpha = 1;

    const mist = context.createRadialGradient(x, ground, 0, x, ground, 18 + flower.depth * 22);
    mist.addColorStop(0, `rgba(${palette.fog},${.045 + flower.depth * .06})`);
    mist.addColorStop(1, `rgba(${palette.fog},0)`);
    context.fillStyle = mist;
    context.fillRect(x - 42, ground - 22, 84, 44);

    const winterArrival = reducedMotion ? 1 : Math.min(1, Math.max(0, (time - index * 65) / 2600));
    bloom(context, flower, x + sway, ground - stemHeight, radius, season === 'winter' ? flower.snow * winterArrival : 0);
  });

  if (season === 'winter') {
    context.fillStyle = '#fff';
    scene.snow.forEach((flake, index) => {
      const travel = reducedMotion ? flake.y : (flake.y + time * flake.speed * .001) % 1.08;
      const x = (flake.x + Math.sin(time * .00055 + flake.phase) * flake.drift + 1) % 1;
      const y = travel * height;
      context.globalAlpha = .45 + flake.size * .16;
      context.beginPath();
      context.arc(x * width, y, flake.size, 0, Math.PI * 2);
      context.fill();
    });
    context.globalAlpha = 1;
  }
}

function render(now) {
  scenes.forEach(scene => drawScene(scene, now));
  if (!reducedMotion) requestAnimationFrame(render);
}

function resize() {
  scenes.forEach(fit);
  if (reducedMotion) render(4000);
}

addEventListener('resize', resize);
resize();
requestAnimationFrame(render);
