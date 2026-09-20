'use strict';

const palette = ['#f0a4b7', '#edc65c', '#83b8df', '#b7a0dc'];

function setup(canvas) {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function stem(ctx, x, ground, top, bend = 0) {
  ctx.strokeStyle = 'rgba(48,112,66,.74)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, ground);
  ctx.quadraticCurveTo(x - bend, (ground + top) / 2, x + bend, top);
  ctx.stroke();
}

function roundFlower(ctx, x, y, color) {
  for (let i = 0; i < 5; i += 1) {
    const angle = i / 5 * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 12, y + Math.sin(angle) * 12, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff0ac'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
}

function bezierFlower(ctx, x, y, color) {
  ctx.save(); ctx.translate(x, y);
  for (let i = 0; i < 6; i += 1) {
    ctx.save(); ctx.rotate(i / 6 * Math.PI * 2 - Math.PI / 2 + i * .025);
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, 2);
    ctx.bezierCurveTo(-7, -3, -8, -18, 1, -25);
    ctx.bezierCurveTo(10, -16, 8, -4, 0, 2); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = '#f8df88'; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function bellFlower(ctx, x, y, color) {
  [-18, 0, 18].forEach((offset, index) => {
    const top = y + Math.abs(index - 1) * 5;
    ctx.strokeStyle = 'rgba(48,112,66,.7)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.quadraticCurveTo(x + offset * .4, top - 9, x + offset, top); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x + offset - 8, top);
    ctx.bezierCurveTo(x + offset - 10, top + 9, x + offset - 6, top + 18, x + offset, top + 19);
    ctx.bezierCurveTo(x + offset + 6, top + 18, x + offset + 10, top + 9, x + offset + 8, top);
    ctx.closePath(); ctx.fill();
  });
}

function spikeFlower(ctx, x, y) {
  ctx.strokeStyle = 'rgba(48,112,66,.72)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y + 30); ctx.quadraticCurveTo(x - 3, y, x + 2, y - 35); ctx.stroke();
  for (let i = 0; i < 11; i += 1) {
    const yy = y + 22 - i * 5.4, side = i % 2 ? 1 : -1;
    ctx.fillStyle = palette[i % palette.length]; ctx.beginPath();
    ctx.ellipse(x + side * (5 + i * .22), yy, 4.8, 3.2, side * .35, 0, Math.PI * 2); ctx.fill();
  }
}

function stippleFlower(ctx, x, y) {
  for (let i = 0; i < 90; i += 1) {
    const angle = i * 2.399, radius = 3 + (i % 15) * 1.35;
    ctx.globalAlpha = .18 + (i % 5) * .08; ctx.fillStyle = palette[i % palette.length];
    ctx.beginPath(); ctx.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * .72, 1.7 + i % 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.fillStyle = '#f5df83'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
}

function render(canvas) {
  const { ctx, width, height } = setup(canvas), x = width / 2, ground = height - 17, top = height * .42;
  stem(ctx, x, ground, top, 4);
  const kind = canvas.dataset.flower;
  if (kind === 'round') roundFlower(ctx, x + 4, top, palette[0]);
  if (kind === 'bezier') bezierFlower(ctx, x + 4, top, palette[2]);
  if (kind === 'bell') bellFlower(ctx, x + 4, top - 8, palette[3]);
  if (kind === 'spike') spikeFlower(ctx, x + 3, top + 8);
  if (kind === 'stipple') stippleFlower(ctx, x + 4, top, palette[0]);
}

document.querySelectorAll('canvas[data-flower]').forEach(render);
