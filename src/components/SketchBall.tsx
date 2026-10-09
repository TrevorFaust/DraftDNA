import { useLayoutEffect, useRef } from 'react';

/**
 * Radii sampled from the NFL silhouette (full belly, tapered round tips).
 * y is in a 180-tall viewBox; r is in a 120-wide viewBox.
 */
const DISKS: { y: number; r: number }[] = [
  { y: 12, r: 0 },
  { y: 13.1, r: 1.85 },
  { y: 14.4, r: 4.1 },
  { y: 16.44, r: 7.6 },
  { y: 18.89, r: 11.8 },
  { y: 21.33, r: 14.78 },
  { y: 23.78, r: 17.87 },
  { y: 26.22, r: 20.18 },
  { y: 28.67, r: 22.46 },
  { y: 31.11, r: 24.71 },
  { y: 33.56, r: 26.19 },
  { y: 36, r: 28.35 },
  { y: 38.44, r: 29.75 },
  { y: 40.89, r: 31.79 },
  { y: 43.33, r: 33.1 },
  { y: 45.78, r: 34.37 },
  { y: 48.22, r: 35.6 },
  { y: 50.67, r: 36.77 },
  { y: 53.11, r: 37.89 },
  { y: 55.56, r: 38.96 },
  { y: 58, r: 39.96 },
  { y: 60.44, r: 40.9 },
  { y: 62.89, r: 41.77 },
  { y: 65.33, r: 42.57 },
  { y: 67.78, r: 42.94 },
  { y: 70.22, r: 43.63 },
  { y: 72.67, r: 44.24 },
  { y: 75.11, r: 44.76 },
  { y: 77.56, r: 45.2 },
  { y: 80, r: 45.38 },
  { y: 82.44, r: 45.68 },
  { y: 84.89, r: 45.88 },
  { y: 87.33, r: 45.95 },
  { y: 89.78, r: 46 },
  { y: 92.22, r: 45.99 },
  { y: 94.67, r: 45.88 },
  { y: 97.11, r: 45.68 },
  { y: 99.56, r: 45.54 },
  { y: 102, r: 45.2 },
  { y: 104.44, r: 44.76 },
  { y: 106.89, r: 44.24 },
  { y: 109.33, r: 43.94 },
  { y: 111.78, r: 43.3 },
  { y: 114.22, r: 42.57 },
  { y: 116.67, r: 41.77 },
  { y: 119.11, r: 40.9 },
  { y: 121.56, r: 39.96 },
  { y: 124, r: 38.96 },
  { y: 126.44, r: 38.43 },
  { y: 128.89, r: 36.77 },
  { y: 131.33, r: 35.6 },
  { y: 133.78, r: 34.37 },
  { y: 136.22, r: 33.1 },
  { y: 138.67, r: 31.79 },
  { y: 141.11, r: 30.44 },
  { y: 143.56, r: 28.35 },
  { y: 146, r: 26.91 },
  { y: 148.44, r: 24.71 },
  { y: 150.89, r: 22.46 },
  { y: 153.33, r: 20.18 },
  { y: 155.78, r: 17.87 },
  { y: 158.22, r: 15.55 },
  { y: 160.67, r: 11.8 },
  { y: 163.11, r: 7.6 },
  { y: 165.2, r: 4.1 },
  { y: 166.5, r: 1.85 },
  { y: 168, r: 0 },
];

const LAT = 36;
const LON = 48;
const STRIPE_LON = 64;
const HALF = 78;
const CAM_X = 8;
const LIGHT: Vec = normalize([-0.38, 0.42, 0.82]);
const PANEL_SEAMS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
const LACE_PHI = Math.PI / 2;

type Vec = [number, number, number];
type Mat = [Vec, Vec, Vec];

function mixBrown(lit: number): string {
  const t = Math.min(1, Math.max(0, lit));
  const r = Math.round(88 + 92 * t);
  const g = Math.round(40 + 46 * t);
  const b = Math.round(16 + 20 * t);
  return `rgb(${r} ${g} ${b})`;
}

function radiusAtY(ySvg: number): number {
  if (ySvg <= DISKS[0].y) return DISKS[0].r;
  for (let i = 1; i < DISKS.length; i += 1) {
    if (ySvg <= DISKS[i].y) {
      const a = DISKS[i - 1];
      const b = DISKS[i];
      const t = (ySvg - a.y) / (b.y - a.y);
      return a.r + (b.r - a.r) * t;
    }
  }
  return DISKS[DISKS.length - 1].r;
}

function normalize(v: Vec): Vec {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}

function dot(a: Vec, b: Vec): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function mul(m: Mat, v: Vec): Vec {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function matMul(a: Mat, b: Mat): Mat {
  const col = (i: number): Vec => [b[0][i], b[1][i], b[2][i]];
  const c0 = mul(a, col(0));
  const c1 = mul(a, col(1));
  const c2 = mul(a, col(2));
  return [
    [c0[0], c1[0], c2[0]],
    [c0[1], c1[1], c2[1]],
    [c0[2], c1[2], c2[2]],
  ];
}

function Rx(rad: number): Mat {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}

function Ry(rad: number): Mat {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}

function Rz(rad: number): Mat {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function surface(yLocal: number, phi: number): Vec {
  const ySvg = 90 - yLocal * HALF;
  const r = radiusAtY(ySvg) / HALF;
  return [r * Math.cos(phi), yLocal, r * Math.sin(phi)];
}

function normalAt(yLocal: number, phi: number): Vec {
  const eps = 0.012;
  const r0 = radiusAtY(90 - yLocal * HALF) / HALF;
  const r1 = radiusAtY(90 - (yLocal + eps) * HALF) / HALF;
  const rp = (r1 - r0) / eps;
  return normalize([Math.cos(phi), -rp, Math.sin(phi)]);
}

function poseMatrix(spin: number, tilt: number, azimuth: number): Mat {
  return matMul(
    Rx(toRad(CAM_X)),
    matMul(Ry(toRad(azimuth)), matMul(Rx(toRad(tilt)), Ry(-spin))),
  );
}

function applyPose(p: Vec, spin: number, tilt: number, azimuth: number): Vec {
  return mul(poseMatrix(spin, tilt, azimuth), p);
}

type SketchBallProps = {
  spin: number;
  tilt: number;
  azimuth: number;
  parked?: boolean;
  className?: string;
};

function facingZ(R: Mat, yLocal: number, lon: number): number {
  return normalize(mul(R, normalAt(yLocal, lon)))[2];
}

function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length < 3) return points;
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (
    o: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: { x: number; y: number }[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: { x: number; y: number }[] = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function drawRibbon(
  ctx: CanvasRenderingContext2D,
  xf: (p: Vec) => Vec,
  R: Mat,
  y0: number,
  y1: number,
  fill: string,
  lineWidth: number,
) {
  const yMid = (y0 + y1) / 2;
  const n = STRIPE_LON;
  const face: number[] = [];
  for (let j = 0; j < n; j += 1) {
    face.push(facingZ(R, yMid, (j / n) * Math.PI * 2));
  }
  const visible: number[] = [];
  for (let j = 0; j < n; j += 1) {
    if (face[j] >= -0.42) visible.push(j);
  }
  if (visible.length < 2) return;

  const runs: number[][] = [];
  let current: number[] = [visible[0]];
  for (let k = 1; k < visible.length; k += 1) {
    if (visible[k] === visible[k - 1] + 1) {
      current.push(visible[k]);
    } else {
      runs.push(current);
      current = [visible[k]];
    }
  }
  runs.push(current);
  const first = runs[0];
  const last = runs[runs.length - 1];
  if (runs.length > 1 && first[0] <= 2 && last[last.length - 1] >= n - 3) {
    runs[0] = last.concat(first);
    runs.pop();
  }

  // A latitude stripe reads as a circle when the ball stands on a tip. If most
  // of the ring is already showing, fill the leftover gap so it closes.
  if (runs.length === 1 && runs[0].length >= n * 0.72) {
    runs[0] = Array.from({ length: n }, (_, j) => j);
  }

  ctx.fillStyle = fill;
  ctx.strokeStyle = '#1a1612';
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  for (const run of runs) {
    if (run.length < 2) continue;
    const top = run.map((j) => xf(surface(y0, (j / n) * Math.PI * 2)));
    const bot = run.map((j) => xf(surface(y1, (j / n) * Math.PI * 2)));
    if (run.length === n) {
      top.push(top[0]);
      bot.push(bot[0]);
    }
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (const p of top) ctx.lineTo(p[0], p[1]);
    for (let k = bot.length - 1; k >= 0; k -= 1) ctx.lineTo(bot[k][0], bot[k][1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawSeam(
  ctx: CanvasRenderingContext2D,
  xf: (p: Vec) => Vec,
  R: Mat,
  lon: number,
  scale: number,
) {
  ctx.strokeStyle = '#3a2418';
  ctx.lineWidth = Math.max(0.6, scale * 0.008);
  let run: { x: number; y: number }[] = [];
  const strokeRun = () => {
    if (run.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(run[0].x, run[0].y);
      for (let i = 1; i < run.length; i += 1) ctx.lineTo(run[i].x, run[i].y);
      ctx.stroke();
    }
    run = [];
  };
  for (let i = 0; i <= 40; i += 1) {
    const y = 1 - (2 * i) / 40;
    if (facingZ(R, y, lon) < -0.16) {
      strokeRun();
      continue;
    }
    const p = xf(surface(y, lon));
    run.push({ x: p[0], y: p[1] });
  }
  strokeRun();
}

function drawLaces(
  ctx: CanvasRenderingContext2D,
  xf: (p: Vec) => Vec,
  R: Mat,
  scale: number,
) {
  const facing = mul(R, [0, 0, 1])[2];
  if (facing < 0.05) return;
  const laceScale = Math.max(Math.abs(facing), 0.2);
  ctx.save();
  ctx.globalAlpha = Math.min(1, (facing - 0.05) / 0.2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const ys = [-0.255, -0.182, -0.109, -0.036, 0.036, 0.109, 0.182, 0.255];
  const halfW = 0.16 * laceScale;
  const left = ys.map((y) => xf(surface(y, LACE_PHI - halfW)));
  const right = ys.map((y) => xf(surface(y, LACE_PHI + halfW)));
  const spineTop = xf(surface(-0.28, LACE_PHI));
  const spineBot = xf(surface(0.28, LACE_PHI));

  ctx.beginPath();
  ctx.moveTo(spineTop[0], spineTop[1]);
  ctx.lineTo(spineBot[0], spineBot[1]);
  ctx.strokeStyle = '#f7f1e6';
  ctx.lineWidth = Math.max(2.2, scale * 0.05) * laceScale;
  ctx.stroke();
  ctx.strokeStyle = '#1a1612';
  ctx.lineWidth = Math.max(0.9, scale * 0.015);
  ctx.stroke();

  for (let k = 0; k < ys.length; k += 1) {
    ctx.beginPath();
    ctx.moveTo(left[k][0], left[k][1]);
    ctx.lineTo(right[k][0], right[k][1]);
    ctx.strokeStyle = '#f7f1e6';
    ctx.lineWidth = Math.max(1.6, scale * 0.032) * laceScale;
    ctx.stroke();
    ctx.strokeStyle = '#1a1612';
    ctx.lineWidth = Math.max(0.8, scale * 0.013);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spin: number,
  tilt: number,
  azimuth: number,
  parked: boolean,
) {
  const R = poseMatrix(spin, tilt, azimuth);
  const scale = parked
    ? Math.min(width * 0.44, height * 0.72)
    : 0.32 * Math.min(width, height);
  const persp = 6.4;
  const origin = applyPose([0, 0, 0], spin, tilt, azimuth);
  const ox = width / 2;
  const oy = height / 2;

  const xf = (p: Vec): Vec => {
    const t = applyPose(p, spin, tilt, azimuth);
    const w = 1 + t[2] / persp;
    return [ox + ((t[0] - origin[0]) / w) * scale, oy - ((t[1] - origin[1]) / w) * scale, t[2]];
  };

  let hx = ox;
  let hy = oy;
  let bestLit = -1;
  for (let i = 0; i <= LAT; i += 1) {
    const y = 1 - (2 * i) / LAT;
    for (let j = 0; j < LON; j += 1) {
      const lon = (j / LON) * Math.PI * 2;
      const n = normalize(mul(R, normalAt(y, lon)));
      if (n[2] <= 0.02) continue;
      const lit = dot(n, LIGHT);
      if (lit <= bestLit) continue;
      bestLit = lit;
      const p = xf(surface(y, lon));
      hx = p[0];
      hy = p[1];
    }
  }

  const rim: { x: number; y: number }[] = [];
  for (let i = 0; i <= LAT; i += 1) {
    const y = 1 - (2 * i) / LAT;
    for (let j = 0; j < LON; j += 1) {
      const lon = (j / LON) * Math.PI * 2;
      if (facingZ(R, y, lon) <= 0.02) continue;
      const pt = xf(surface(y, lon));
      rim.push({ x: pt[0], y: pt[1] });
    }
  }
  const tipA = xf([0, 1, 0]);
  const tipB = xf([0, -1, 0]);
  rim.push({ x: tipA[0], y: tipA[1] });
  rim.push({ x: tipB[0], y: tipB[1] });
  const hull = convexHull(rim);

  ctx.clearRect(0, 0, width, height);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (hull.length > 4) {
    let minX = hull[0].x;
    let maxX = hull[0].x;
    let minY = hull[0].y;
    let maxY = hull[0].y;
    for (const p of hull) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const foot = xf([0, -1, 0]);
    const lie = Math.min(1, Math.max(0, (tilt - 40) / 50));
    const sx = foot[0] * (1 - lie) + ((minX + maxX) / 2) * lie;
    const sy = foot[1] * (1 - lie) + (maxY + scale * 0.05) * lie;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx, sy + scale * 0.04, scale * (0.11 + 0.22 * lie), scale * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(hull[0].x, hull[0].y);
    for (let i = 1; i < hull.length; i += 1) ctx.lineTo(hull[i].x, hull[i].y);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    const glow = ctx.createRadialGradient(hx, hy, scale * 0.04, hx, hy, scale * 1.05);
    glow.addColorStop(0, mixBrown(0.98));
    glow.addColorStop(0.38, mixBrown(0.7));
    glow.addColorStop(0.72, mixBrown(0.42));
    glow.addColorStop(1, mixBrown(0.22));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    const stripeWidth = Math.max(0.8, scale * 0.014);
    drawRibbon(ctx, xf, R, 0.667, 0.487, '#efe6d6', stripeWidth);
    drawRibbon(ctx, xf, R, -0.487, -0.667, '#efe6d6', stripeWidth);
    for (const seam of PANEL_SEAMS) {
      drawSeam(ctx, xf, R, seam, scale);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(hull[0].x, hull[0].y);
    for (let i = 1; i < hull.length; i += 1) ctx.lineTo(hull[i].x, hull[i].y);
    ctx.closePath();
    ctx.strokeStyle = '#1a1612';
    ctx.lineWidth = Math.max(1.8, scale * 0.026);
    ctx.stroke();
  }

  drawLaces(ctx, xf, R, scale);
}

export function SketchBall({ spin, tilt, azimuth, parked, className }: SketchBallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const paint = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBall(ctx, width, height, spin, tilt, azimuth, Boolean(parked));
    };

    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [spin, tilt, azimuth, parked]);

  return (
    <div className={['sketch-ball-3d', className].filter(Boolean).join(' ')}>
      <canvas ref={canvasRef} className="sketch-ball-canvas" />
    </div>
  );
}
