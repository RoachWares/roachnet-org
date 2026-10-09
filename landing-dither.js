// Mission page dithered parallax background (moved out of index.html for the CSP).
/* Dithered parallax background */
;(function () {
  const canvas = document.getElementById('dither-canvas');
  if (!canvas) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;
  let w, h, cols, rows;
  let scrollY = 0;
  let pointerX = 0.5;
  let pointerY = 0.28;
  let smoothX = pointerX;
  let smoothY = pointerY;
  let start = performance.now();
  let lastDraw = 0;
  let raf;

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    const scale = w < 720 ? 9 : w > 1680 ? 8 : 7;
    canvas.width = Math.ceil(w / scale);
    canvas.height = Math.ceil(h / scale);
    cols = canvas.width;
    rows = canvas.height;
  }

  // Bayer 4x4 dither matrix (normalized 0-1)
  const bayer = [
    [ 0/16,  8/16,  2/16, 10/16],
    [12/16,  4/16, 14/16,  6/16],
    [ 3/16, 11/16,  1/16,  9/16],
    [15/16,  7/16, 13/16,  5/16]
  ];

  function hash(x, y) {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function smoothstep(edge0, edge1, value) {
    const t = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
    return t * t * (3 - 2 * t);
  }

  function valueNoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    const ab = a + (b - a) * ux;
    const cd = c + (d - c) * ux;
    return ab + (cd - ab) * uy;
  }

  function fbm(x, y) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let octave = 0; octave < 4; octave++) {
      value += valueNoise(x * frequency, y * frequency) * amplitude;
      frequency *= 2.04;
      amplitude *= 0.52;
    }
    return value;
  }

  function draw(now) {
    if (document.visibilityState === 'hidden') {
      raf = 0;
      return;
    }

    if (!reducedMotion.matches && lastDraw && now - lastDraw < 50) {
      raf = requestAnimationFrame(draw);
      return;
    }

    lastDraw = now;
    const time = reducedMotion.matches ? 0 : (now - start) / 1000;
    const imgData = ctx.createImageData(cols, rows);
    const data = imgData.data;
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scroll = Math.min(1, Math.max(0, scrollY / scrollable));
    smoothX += (pointerX - smoothX) * 0.075;
	          smoothY += (pointerY - smoothY) * 0.075;
	          const centerX = smoothX * 0.58 + 0.21;
	          const centerY = smoothY * 0.48 + 0.12 + scroll * 0.05;
	          const aspect = w / Math.max(h, 1);
	          const rayOriginX = 0.5 + (smoothX - 0.5) * 0.18;
	          const rayOriginY = -0.16 + smoothY * 0.16;

    const beacons = [
      [0.14, 0.18, 0.62, 0],
      [0.48, 0.25, 1.0, 1],
      [0.78, 0.16, 0.66, 1],
      [0.18, 0.58, 0.5, 0],
      [0.82, 0.7, 0.42, 2],
    ];

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
	              const px = x / cols;
	              const py = y / rows;
	              const ax = (px - 0.5) * aspect + 0.5;
	              const dx = px - centerX;
	              const dy = py - centerY;
	              const radius = Math.sqrt(dx * dx + dy * dy);
	              const horizon = Math.max(0, 1 - Math.abs(py - 0.32 - scroll * 0.08) * 2.72);
	              const vanishing = Math.max(0, 1 - Math.abs(px - 0.5) * 1.44);
	              const noiseA = fbm(px * 3.15 + time * 0.035 + scroll * 0.72, py * 3.8 - time * 0.028 + smoothY * 0.62);
	              const noiseB = fbm(px * 7.2 - time * 0.055 + smoothX, py * 5.4 + time * 0.04 + scroll * 0.9);
	              const layer1 = Math.sin(radius * 58 - time * 1.64 + scroll * 10.5 + noiseA * 2.1);
	              const layer2 = Math.sin(px * 15 + py * 8.6 + time * 0.44 + scroll * 4.8 + noiseB * 2.6);
	              const layer3 = Math.cos((px - py) * 28 - time * 0.32 + smoothX * 1.2);
	              const lattice = Math.sin((px + smoothX * 0.22) * 43) * Math.cos((py - smoothY * 0.16) * 29);
	              const rayDx = (ax - rayOriginX) * 1.12;
	              const rayDy = py - rayOriginY;
	              const rayDistance = Math.sqrt(rayDx * rayDx + rayDy * rayDy);
	              const rayAngle = Math.atan2(rayDy, rayDx);
	              const rayNoise = fbm(rayAngle * 2.1 + time * 0.05, rayDistance * 5.8 - time * 0.12 + scroll);
	              const rayStripe = Math.max(0, Math.sin(rayAngle * 17 + rayNoise * 5.2 + time * 0.34 + scroll * 2.2));
	              const godRay = smoothstep(0.46, 0.96, rayStripe + rayNoise * 0.42) * Math.pow(Math.max(0, 1 - rayDistance * 0.8), 2.1);
	              const hexA = Math.abs(Math.sin((ax * 9.1 + py * 3.35 + scroll * 0.8 + time * 0.05) * Math.PI));
	              const hexB = Math.abs(Math.sin((ax * -4.55 + py * 8.55 - scroll * 0.55 + time * 0.04) * Math.PI));
	              const hexC = Math.abs(Math.sin((ax * 4.55 + py * 8.55 + smoothX * 0.5 - time * 0.045) * Math.PI));
	              const hexGrid = Math.max(0, 1 - Math.min(hexA, hexB, hexC) * 15) * (0.42 + noiseB * 0.74);
	              const plasma = Math.sin((noiseA * 5.8 + noiseB * 3.4 + px * 3.1 - py * 2.6 + time * 0.21 + scroll * 1.5) * Math.PI);
	              const wireA = Math.max(0, 1 - Math.abs(Math.sin((px * 2.22 + py * 1.48 + scroll * 0.7) * Math.PI * 8 + time * 0.26)) * 13);
	              const wireB = Math.max(0, 1 - Math.abs(Math.sin((px * -1.2 + py * 2.08 + scroll * 0.42) * Math.PI * 7 - time * 0.22)) * 17);
	              const scanBand = Math.max(0, 1 - Math.abs(py - (0.15 + scroll * 0.36)) * 7.5);
	              const corridor = Math.max(0, 1 - Math.abs(py - (0.77 - Math.abs(px - 0.5) * 0.48 + scroll * 0.05)) * 11);
	              const dustSeed = hash(x, y);
	              const dust = dustSeed > 0.938 ? (dustSeed - 0.938) * 1.55 : 0;
	              const starSeed = hash(Math.floor(px * 116 + scroll * 11), Math.floor(py * 92 - time * 2.2));
	              const star = starSeed > 0.991 ? (starSeed - 0.991) * 42 : 0;
	              const vhsTear = Math.max(0, 1 - Math.abs(Math.sin((py + noiseA * 0.08 + time * 0.035) * 122)) * 28) * (0.26 + noiseB * 0.6);
	              let beacon = 0;
	              let beaconTone = 0;

        for (const [bx, by, power, tone] of beacons) {
          const driftX = bx + Math.sin(time * 0.13 + tone * 1.8 + scroll * 2) * 0.024;
          const driftY = by + Math.cos(time * 0.11 + tone * 1.4 + scroll * 1.6) * 0.018;
          const bdx = px - driftX;
          const bdy = py - driftY;
          const beamCore = Math.max(0, 1 - Math.sqrt(bdx * bdx + bdy * bdy) * 3.9) * power;
	                const beamSweep = Math.max(0, 1 - Math.abs(Math.atan2(bdy, bdx) - Math.sin(time * 0.17 + tone + noiseA) * 0.9) * 0.5) * beamCore;
	                const beam = beamCore + beamSweep * 0.2;
          if (beam > beacon) {
            beacon = beam;
            beaconTone = tone;
          }
        }

	              const combined = 0.045 + layer1 * 0.18 + layer2 * 0.17 + layer3 * 0.12 + lattice * 0.13 + (noiseA - 0.5) * 0.24 + (noiseB - 0.5) * 0.12 + plasma * 0.08 + horizon * 0.12 + vanishing * corridor * 0.12 + scanBand * 0.18 + wireA * 0.19 + wireB * 0.12 + godRay * 0.5 + hexGrid * 0.22 + dust * 0.16 + star * 0.16 + vhsTear * 0.08 + beacon * 0.5;
	              const vignette = Math.max(0, 1 - radius * 1.55);
	              const threshold = bayer[y % 4][x % 4] + 0.24 - vignette * 0.055 - beacon * 0.32 - scanBand * 0.085 - wireA * 0.075 - godRay * 0.16 - hexGrid * 0.05;
	              const on = combined > threshold ? 1 : 0;
	              const idx = (y * cols + x) * 4;
	              const tonePhase = Math.sin(px * 7 - py * 10 + time * 0.44 + scroll * 3.6 + noiseB);
	              const purple = beaconTone === 1 || tonePhase > 0.28 || godRay > 0.34;
	              const blue = beaconTone === 2 && tonePhase < -0.18;
	              data[idx] = on ? (purple ? 125 + Math.round(vignette * 48 + beacon * 22 + godRay * 16) : blue ? 28 : 18 + Math.round(scanBand * 10 + star * 10)) : 2;
	              data[idx + 1] = on ? (purple ? 46 + Math.round(horizon * 28 + beacon * 12) : blue ? 82 : 84 + Math.round(vignette * 74 + horizon * 38 + hexGrid * 18)) : 2;
	              data[idx + 2] = on ? (purple ? 188 + Math.round(vignette * 34 + beacon * 18 + godRay * 18) : blue ? 138 + Math.round(horizon * 46) : 82 + Math.round((vignette + horizon) * 23)) : 8;
	              data[idx + 3] = on ? 9 + Math.round(vignette * 20 + horizon * 10 + scanBand * 14 + beacon * 38 + wireA * 11 + godRay * 22 + hexGrid * 9 + star * 18) : Math.round(godRay * 2);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    canvas.parentElement?.style.setProperty('--landing-dither-scroll', scroll.toFixed(4));
    if (!reducedMotion.matches) {
      raf = requestAnimationFrame(draw);
    }
  }

  window.addEventListener('scroll', function () {
    scrollY = window.scrollY;
  }, { passive: true });

  window.addEventListener('pointermove', function (event) {
    pointerX = Math.max(0, Math.min(1, event.clientX / Math.max(1, w)));
    pointerY = Math.max(0, Math.min(1, event.clientY / Math.max(1, h)));
  }, { passive: true });

  window.addEventListener('resize', function () {
    resize();
    draw(performance.now());
  });

  resize();
  draw(performance.now());
  reducedMotion.addEventListener?.('change', function () {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    start = performance.now();
    draw(performance.now());
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && !raf) {
      start = performance.now();
      raf = requestAnimationFrame(draw);
    }
  });
})();
