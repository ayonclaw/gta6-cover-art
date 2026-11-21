// Canvas renderer: four independently cropped images, a warm neon grade, drawn palm silhouettes and poster lettering.
const COLORWAYS = {
  sunset: { rose: '#ed438f', aqua: '#39c9d5', sun: '#ffbf68', ink: '#23132c' },
  tidal: { rose: '#9b62ef', aqua: '#35edce', sun: '#ffc96e', ink: '#111b31' },
  after: { rose: '#ff477c', aqua: '#7cddff', sun: '#f6ca65', ink: '#211327' },
};

export function panelRects(width, height) {
  const gap = Math.max(5, Math.round(Math.min(width, height) * 0.007));
  const splitX = Math.round(width * (width / height > 1.55 ? 0.5 : 0.515));
  const splitY = Math.round(height * (height / width > 1.15 ? 0.55 : 0.49));
  const left = splitX;
  const right = width - splitX - gap;
  const top = splitY;
  const bottom = height - splitY - gap;
  return [
    { x: 0, y: 0, width: left, height: top },
    { x: splitX + gap, y: 0, width: right, height: top },
    { x: 0, y: splitY + gap, width: left, height: bottom },
    { x: splitX + gap, y: splitY + gap, width: right, height: bottom },
  ];
}

function drawPanel(ctx, rect, panel, index, palette) {
  const { x, y, width, height } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.fillStyle = palette.ink;
  ctx.fillRect(x, y, width, height);
  if (panel.image) {
    const image = panel.image;
    const fit = Math.max(width / image.naturalWidth, height / image.naturalHeight) * panel.zoom;
    const imageWidth = image.naturalWidth * fit;
    const imageHeight = image.naturalHeight * fit;
    const spareX = Math.max(0, imageWidth - width);
    const spareY = Math.max(0, imageHeight - height);
    const imageX = x + (width - imageWidth) / 2 + panel.panX * spareX * 0.68;
    const imageY = y + (height - imageHeight) / 2 + panel.panY * spareY * 0.68;
    ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
  }
  ctx.fillStyle = index % 2 === 0 ? 'rgba(244,52,137,.17)' : 'rgba(31,197,209,.15)';
  ctx.fillRect(x, y, width, height);
  const wash = ctx.createLinearGradient(x, y, x + width, y + height);
  wash.addColorStop(0, `${palette.rose}33`);
  wash.addColorStop(0.55, 'rgba(18,12,33,0)');
  wash.addColorStop(1, `${palette.aqua}35`);
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

function drawSun(ctx, x, y, radius, colour) {
  const halo = ctx.createRadialGradient(x, y, radius * 0.35, x, y, radius * 1.8);
  halo.addColorStop(0, `${colour}44`);
  halo.addColorStop(1, `${colour}00`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.8, 0, Math.PI * 2);
  ctx.fill();
  const disc = ctx.createLinearGradient(x, y - radius, x, y + radius);
  disc.addColorStop(0, '#fff0ae');
  disc.addColorStop(0.55, colour);
  disc.addColorStop(1, '#ff648b');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.83, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(244,72,133,.78)';
  for (let band = 0; band < 4; band++) {
    const bandY = y + radius * (0.08 + band * 0.18);
    ctx.fillRect(x - radius, bandY, radius * 2, Math.max(2, radius * 0.045));
  }
  ctx.restore();
}

function drawPalm(ctx, baseX, baseY, height, scale = 1) {
  const crownX = baseX - height * 0.12;
  const crownY = baseY - height;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(20,12,32,.88)';
  ctx.lineWidth = Math.max(3, height * 0.055);
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.bezierCurveTo(baseX - height * 0.08, baseY - height * 0.28, crownX + height * 0.12, crownY + height * 0.25, crownX, crownY);
  ctx.stroke();
  ctx.lineWidth = Math.max(2, height * 0.027);
  const leaves = [-2.72, -2.28, -1.82, -1.37, -0.92, -0.48, -0.13];
  for (const angle of leaves) {
    const reach = height * (0.34 + (Math.abs(angle + 1.55) / 5) * 0.1) * scale;
    const endX = crownX + Math.cos(angle) * reach;
    const endY = crownY + Math.sin(angle) * reach * 0.66;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(crownX + Math.cos(angle - 0.2) * reach * 0.42, crownY + Math.sin(angle - 0.2) * reach * 0.38, endX, endY);
    ctx.stroke();
    for (let leaflet = 1; leaflet <= 4; leaflet++) {
      const t = leaflet / 5;
      const midX = crownX + (endX - crownX) * t;
      const midY = crownY + (endY - crownY) * t;
      const drop = height * 0.055 * (1 - t * 0.5);
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX - height * 0.06, midY + drop);
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX + height * 0.06, midY + drop);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawTrackedText(ctx, text, x, y, maxWidth, baseSize, tracking, palette, chrome) {
  let size = baseSize;
  const measure = (value) => [...value].reduce((width, char, index) => width + ctx.measureText(char).width + (index ? tracking * size / 100 : 0), 0);
  const font = () => `900 ${size}px Impact, "Arial Narrow", "DejaVu Sans Condensed", system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font();
  while (size > 16 && measure(text) > maxWidth) {
    size *= 0.94;
    ctx.font = font();
  }
  const gap = tracking * size / 100;
  if (chrome) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.075);
    ctx.strokeStyle = '#40eff0';
    ctx.shadowColor = '#f33ca8';
    ctx.shadowBlur = size * 0.35;
    let cursor = x;
    for (const char of text) {
      ctx.strokeText(char, cursor, y);
      cursor += ctx.measureText(char).width + gap;
    }
    ctx.restore();
  }
  const fill = ctx.createLinearGradient(x, y - size, x + maxWidth * 0.76, y);
  fill.addColorStop(0, '#fff7e9');
  fill.addColorStop(0.45, '#fff');
  fill.addColorStop(0.8, palette.sun);
  fill.addColorStop(1, '#ffb4dc');
  ctx.fillStyle = fill;
  ctx.shadowColor = 'rgba(9,5,20,.64)';
  ctx.shadowBlur = size * 0.16;
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + gap;
  }
  ctx.shadowBlur = 0;
}

function grainFor(ctx) {
  const tile = document.createElement('canvas');
  tile.width = 96;
  tile.height = 96;
  const tileContext = tile.getContext('2d');
  const pixels = tileContext.createImageData(tile.width, tile.height);
  let seed = 862173;
  for (let index = 0; index < pixels.data.length; index += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const light = 180 + (seed % 76);
    pixels.data[index] = light;
    pixels.data[index + 1] = light;
    pixels.data[index + 2] = light;
    pixels.data[index + 3] = 24;
  }
  tileContext.putImageData(pixels, 0, 0);
  return ctx.createPattern(tile, 'repeat');
}

function drawCover(ctx, width, height, panels, options, getGrain, setGrain) {
  const palette = COLORWAYS[options.colorway] ?? COLORWAYS.sunset;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#171224';
  ctx.fillRect(0, 0, width, height);
  const rects = panelRects(width, height);
  rects.forEach((rect, index) => drawPanel(ctx, rect, panels[index], index, palette));

  const inset = Math.min(width, height) * 0.055;
  const sunRadius = Math.min(width, height) * 0.095;
  drawSun(ctx, width * 0.805, height * 0.245, sunRadius, palette.sun);
  drawPalm(ctx, width * 0.96, height * 0.54, height * 0.32, 0.9);
  drawPalm(ctx, width * 0.62, height * 0.51, height * 0.19, 0.82);

  const shade = ctx.createLinearGradient(0, height * 0.56, 0, height);
  shade.addColorStop(0, 'rgba(16,9,27,0)');
  shade.addColorStop(0.36, 'rgba(16,9,27,.34)');
  shade.addColorStop(1, 'rgba(14,8,24,.92)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, height * 0.54, width, height * 0.46);

  ctx.fillStyle = 'rgba(15,10,25,.58)';
  ctx.fillRect(inset, height * 0.047, width * 0.32, height * 0.043);
  ctx.fillStyle = '#fff1df';
  ctx.font = `700 ${Math.max(10, height * 0.019)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('AFTERGLOW  /  ORIGINAL STORIES', inset * 1.3, height * 0.068);
  ctx.textAlign = 'right';
  ctx.fillStyle = palette.sun;
  ctx.font = `800 ${Math.max(10, height * 0.018)}px system-ui, sans-serif`;
  ctx.fillText('VICE COAST  •  06', width - inset, height * 0.069);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = palette.sun;
  ctx.font = `800 ${Math.max(10, height * 0.018)}px system-ui, sans-serif`;
  ctx.fillText('NO MAP. NO RULES. JUST TONIGHT.', inset, height * 0.738);
  const raw = options.caption.trim() || 'YOUR STORY';
  const title = options.caseStyle === 'title' ? raw.toLocaleLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase()) : raw.toLocaleUpperCase();
  drawTrackedText(ctx, title, inset * 0.94, height * 0.858, width - inset * 1.88, height * 0.107, options.tracking, palette, options.chrome);

  ctx.strokeStyle = `${palette.sun}cc`;
  ctx.lineWidth = Math.max(1, height * 0.0024);
  ctx.beginPath();
  ctx.moveTo(inset, height * 0.891);
  ctx.lineTo(width - inset, height * 0.891);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,247,235,.82)';
  ctx.font = `700 ${Math.max(9, height * 0.014)}px system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText('A STORY IN EVERY STREET', inset, height * 0.928);
  ctx.textAlign = 'right';
  ctx.fillStyle = palette.aqua;
  ctx.fillText('SUNSET • SPEED • SECOND CHANCES', width - inset, height * 0.928);

  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.45, Math.min(width, height) * 0.28, width * 0.5, height * 0.45, Math.max(width, height) * 0.78);
  vignette.addColorStop(0, 'rgba(8,5,19,0)');
  vignette.addColorStop(1, 'rgba(8,5,19,.48)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  let grain = getGrain();
  if (!grain) {
    grain = grainFor(ctx);
    setGrain(grain);
  }
  if (grain) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,241,222,.55)';
  ctx.lineWidth = Math.max(1, height * 0.002);
  ctx.strokeRect(Math.min(width, height) * 0.023, Math.min(width, height) * 0.023, width - Math.min(width, height) * 0.046, height - Math.min(width, height) * 0.046);
}

export { drawCover };
