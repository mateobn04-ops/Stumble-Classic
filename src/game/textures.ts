import * as THREE from 'three';

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createCheckerTexture(
  anisotropy: number,
  c1 = '#ffffff',
  c2 = '#1e293b',
  repeatX = 8,
  repeatY = 2,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const step = 64;
  for (let y = 0; y < 256; y += step) {
    for (let x = 0; x < 256; x += step) {
      const even = ((x / step) + (y / step)) % 2 === 0;
      ctx.fillStyle = even ? c1 : c2;
      ctx.fillRect(x, y, step, step);
    }
  }
  return finalizeTexture(canvas, anisotropy, repeatX, repeatY);
}

export function createTrackGridTexture(
  anisotropy: number,
  baseHex: string,
  lineHex: string,
  repeatX = 2,
  repeatY = 4,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = lineHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 248);

  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.stroke();

  return finalizeTexture(canvas, anisotropy, repeatX, repeatY);
}

export function createChevronTexture(
  anisotropy: number,
  bgHex: string,
  arrowHex: string,
  repeatX = 1,
  repeatY = 4,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = arrowHex;
  ctx.lineWidth = 26;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const offsetY of [96, 216]) {
    ctx.beginPath();
    ctx.moveTo(42, offsetY + 48);
    ctx.lineTo(128, offsetY - 24);
    ctx.lineTo(214, offsetY + 48);
    ctx.stroke();
  }

  return finalizeTexture(canvas, anisotropy, repeatX, repeatY);
}

export function createHazardStripeTexture(
  anisotropy: number,
  c1 = '#facc15',
  c2 = '#dc2626',
  repeatX = 4,
  repeatY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = c2;
  for (let i = -256; i < 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 32, 0);
    ctx.lineTo(i - 96, 256);
    ctx.lineTo(i - 128, 256);
    ctx.closePath();
    ctx.fill();
  }
  return finalizeTexture(canvas, anisotropy, repeatX, repeatY);
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(10, 20, 40, 0.48)');
  grad.addColorStop(0.6, 'rgba(10, 20, 40, 0.2)');
  grad.addColorStop(1, 'rgba(10, 20, 40, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createCharacterPatternTexture(
  pattern: 'stripes' | 'ribs' | 'mech' | 'rojinegro' | 'monopoly_board' | 'monopoly_money' | 'dice' | 'none',
  bodyHex: number,
  accentHex: number,
): THREE.CanvasTexture | null {
  if (pattern === 'none') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#' + bodyHex.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#' + accentHex.toString(16).padStart(6, '0');

  if (pattern === 'stripes') {
    ctx.fillRect(0, 96, 256, 22);
    ctx.fillRect(0, 134, 256, 12);
  } else if (pattern === 'rojinegro') {
    // Classic red & black vertical jersey stripes with yellow trim
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#0f172a';
    for (let x = 0; x < 256; x += 64) {
      ctx.fillRect(x, 0, 32, 256);
    }
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 214, 256, 14);
  } else if (pattern === 'monopoly_board') {
    ctx.fillStyle = '#d1fae5';
    ctx.fillRect(0, 0, 256, 256);
    const props = ['#ef4444', '#facc15', '#22c55e', '#2563eb'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = props[i];
      ctx.fillRect(i * 64, 0, 62, 46);
      ctx.fillRect(i * 64, 210, 62, 46);
    }
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(46, 102, 164, 48);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MONOPOLY', 128, 126);
  } else if (pattern === 'monopoly_money') {
    ctx.fillStyle = '#bbf7d0';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 14;
    ctx.strokeRect(18, 36, 220, 184);
    ctx.fillStyle = '#166534';
    ctx.font = '900 96px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 128, 130);
  } else if (pattern === 'dice') {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#0f172a';
    const pips: Array<[number, number]> = [
      [68, 72],
      [188, 72],
      [128, 128],
      [68, 184],
      [188, 184],
    ];
    for (const [px, py] of pips) {
      ctx.beginPath();
      ctx.arc(px, py, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pattern === 'ribs') {
    for (let y = 70; y <= 170; y += 26) {
      ctx.beginPath();
      ctx.roundRect(78, y, 100, 13, 6);
      ctx.fill();
    }
    ctx.fillRect(120, 62, 16, 126);
  } else if (pattern === 'mech') {
    ctx.fillRect(68, 76, 120, 74);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(82, 90, 92, 46);
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(92, 104, 34, 14);
    ctx.fillRect(136, 104, 30, 14);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
