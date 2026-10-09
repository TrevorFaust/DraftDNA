import type { RefObject } from 'react';

export const WHITE = '#f4f7fb';
export const BLUE = '#2a62c8';
export const BLUE_DARK = '#1a3f86';
export const RED = '#e24b3a';
export const SKIN = '#8d5a38';
export const SKIN_SHADOW = '#6f4128';
export const VISOR = '#14161c';
export const MASK = '#c5ced6';
export const HELMET_SHADE = '#d5dbe3';
export const BALL = '#6b3e24';
export const LACE = '#f3e6c8';

export const THIGH = 78;
export const SHIN = 72;
export const GROUND = 458;

export const BACK_HIP = { x: 56, y: 356 };
export const FRONT_HIP = { x: 96, y: 362 };
export const BODY_PIVOT = { x: 78, y: 340 };
export const NEAR_SHOULDER = { x: 172, y: 172 };
export const FAR_SHOULDER = { x: 88, y: 198 };

export type Hip = { x: number; y: number };
export type Pt = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Knee is the solution further to the right, so both legs fold toward the push. */
export function solveLeg(hip: Pt, foot: Pt) {
  let dx = foot.x - hip.x;
  let dy = foot.y - hip.y;
  let dist = Math.hypot(dx, dy);
  const max = THIGH + SHIN - 0.5;
  const min = Math.abs(THIGH - SHIN) + 0.5;
  if (dist < 0.001) dist = 0.001;
  if (dist > max) {
    dx *= max / dist;
    dy *= max / dist;
    dist = max;
  } else if (dist < min) {
    dx *= min / dist;
    dy *= min / dist;
    dist = min;
  }
  const toFoot = Math.atan2(dx, dy);
  const cosA = clamp((THIGH * THIGH + dist * dist - SHIN * SHIN) / (2 * THIGH * dist), -1, 1);
  const bend = Math.acos(cosA);
  const kneeX = (theta: number) => hip.x + Math.sin(theta) * THIGH;
  const thigh = kneeX(toFoot + bend) >= kneeX(toFoot - bend) ? toFoot + bend : toFoot - bend;
  const knee = {
    x: hip.x + Math.sin(thigh) * THIGH,
    y: hip.y + Math.cos(thigh) * THIGH,
  };
  const shin = Math.atan2(foot.x - knee.x, foot.y - knee.y);
  const thighDeg = (-thigh * 180) / Math.PI;
  const shinDeg = ((thigh - shin) * 180) / Math.PI;
  return { thighDeg, shinDeg, cleatDeg: -(thighDeg + shinDeg) };
}

export function svgRotate(p: Pt, origin: Pt, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: origin.x + c * dx - s * dy, y: origin.y + s * dx + c * dy };
}

/** Stance keeps the foot planted. Swing lifts it through to the next lunge. */
export function footTarget(cycle: number, hip: Hip, hipDrop: number, step: number, lift: number): Pt {
  const local = ((cycle % 2) + 2) % 2;
  if (local < 1) {
    return {
      x: hip.x + step * 0.5 - local * step,
      y: GROUND - hipDrop,
    };
  }
  const s = local - 1;
  const glide = s * s * (3 - 2 * s);
  return {
    x: hip.x - step * 0.5 + glide * step,
    y: GROUND - hipDrop - Math.sin(s * Math.PI) * lift,
  };
}

export function Helmet() {
  return (
    <g>
      <ellipse cx="-2" cy="4" rx="58" ry="50" fill={HELMET_SHADE} />
      <ellipse cx="2" cy="0" rx="56" ry="48" fill={WHITE} stroke="#1c1916" strokeWidth="3" />
      <path
        d="M-6 -46 C10 -50, 18 -18, 16 30 C8 48, -10 46, -18 22 C-10 6, -12 -22, -6 -46 Z"
        fill={BLUE}
      />
      <path d="M10 -44 C22 -36, 26 -8, 22 26" fill="none" stroke={RED} strokeWidth="8" strokeLinecap="round" />
      <path
        d="M10 -6 C32 -18, 58 -6, 62 12 C64 24, 50 34, 26 32 C12 24, 6 10, 10 -6 Z"
        fill={VISOR}
      />
      <path
        d="M22 6 H64 M26 18 H62 M32 30 H54"
        fill="none"
        stroke={MASK}
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <path d="M60 -4 C74 10, 72 30, 54 40" fill="none" stroke={MASK} strokeWidth="3.6" strokeLinecap="round" />
      <ellipse cx="-32" cy="8" rx="7" ry="11" fill="#23262c" />
      <ellipse cx="-16" cy="-22" rx="16" ry="8" fill="#ffffff" opacity="0.55" transform="rotate(-28 -16 -22)" />
    </g>
  );
}

export function PlayerShell({ number }: { number: string }) {
  return (
    <g transform="translate(-40 8)">
      <ellipse cx="116" cy="338" rx="48" ry="26" fill={BLUE_DARK} />
      <ellipse cx="116" cy="334" rx="46" ry="24" fill={BLUE} />
      <path d="M74 328 C78 292, 96 300, 116 312 C136 324, 154 318, 164 300" fill="none" stroke="#f4f7fb" strokeWidth="5" strokeLinecap="round" />
      <path d="M78 334 C84 308, 108 314, 132 326" fill="none" stroke={RED} strokeWidth="3" strokeLinecap="round" />

      <path
        d="M74 316
           C66 258, 72 206, 98 164
           C118 136, 158 130, 196 156
           C218 176, 220 214, 200 268
           C186 308, 162 334, 138 344
           C112 354, 86 338, 74 316 Z"
        fill={WHITE}
        stroke="#1c1916"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M92 300 C98 246, 118 210, 146 196"
        fill="none"
        stroke="#e6edf5"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <ellipse cx="148" cy="164" rx="64" ry="28" fill={WHITE} />
      <path d="M88 158 Q148 128 212 160" fill="none" stroke={BLUE} strokeWidth="9" strokeLinecap="round" />
      <path d="M92 168 Q148 142 208 170" fill="none" stroke={RED} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M118 150 L152 176 L184 148 L168 142 L152 158 L136 142 Z" fill={BLUE} />
      <path d="M126 154 L152 170 L176 152" fill="none" stroke={RED} strokeWidth="3" strokeLinecap="round" />

      <path d="M132 132 C138 150, 156 156, 170 146 L164 128 C154 118, 140 118, 132 132 Z" fill={SKIN} />

      <g transform="translate(156 96)">
        <Helmet />
      </g>

      <text
        x="150"
        y="268"
        textAnchor="middle"
        fontFamily="Arial Black, Impact, sans-serif"
        fontSize="46"
        fontWeight="800"
        fill={BLUE}
        stroke={WHITE}
        strokeWidth="6"
        paintOrder="stroke"
      >
        {number}
      </text>
    </g>
  );
}

export function Leg({
  hip,
  thighRef,
  shinRef,
  cleatRef,
}: {
  hip: Hip;
  thighRef: RefObject<SVGGElement>;
  shinRef: RefObject<SVGGElement>;
  cleatRef: RefObject<SVGGElement>;
}) {
  return (
    <g transform={`translate(${hip.x} ${hip.y})`}>
      <g ref={thighRef}>
        <line x1="0" y1="0" x2="0" y2={THIGH} stroke={BLUE_DARK} strokeWidth="40" strokeLinecap="round" />
        <line x1="0" y1="6" x2="0" y2={THIGH - 4} stroke={BLUE} strokeWidth="30" strokeLinecap="round" />
        <line x1="0" y1="18" x2="0" y2={THIGH - 16} stroke={WHITE} strokeWidth="5" strokeLinecap="butt" />
        <line x1="7" y1="18" x2="7" y2={THIGH - 16} stroke={RED} strokeWidth="3" strokeLinecap="butt" />
        <g transform={`translate(0 ${THIGH})`}>
          <g ref={shinRef}>
            <line x1="0" y1="0" x2="0" y2={SHIN - 16} stroke={SKIN_SHADOW} strokeWidth="26" strokeLinecap="round" />
            <line x1="0" y1="2" x2="0" y2={SHIN - 18} stroke={SKIN} strokeWidth="18" strokeLinecap="round" />
            <line x1="0" y1={SHIN - 28} x2="0" y2={SHIN - 2} stroke={WHITE} strokeWidth="24" strokeLinecap="butt" />
            <line x1="0" y1={SHIN - 24} x2="0" y2={SHIN - 18} stroke={BLUE} strokeWidth="24" strokeLinecap="butt" />
            <line x1="0" y1={SHIN - 16} x2="0" y2={SHIN - 11} stroke={RED} strokeWidth="24" strokeLinecap="butt" />
            <g ref={cleatRef} transform={`translate(0 ${SHIN})`}>
              <path
                d="M-12 -8 H16 C28 -8 40 -2 42 6 C44 14 34 18 22 18 H-14 C-22 18 -24 10 -18 -2 C-16 -6 -14 -8 -12 -8 Z"
                fill={RED}
              />
              <path d="M-4 4 H28" stroke="#ffd7d2" strokeWidth="2" strokeLinecap="round" />
            </g>
          </g>
        </g>
        <circle cx="0" cy={THIGH} r="7" fill={BLUE} stroke={BLUE_DARK} strokeWidth="3" />
      </g>
    </g>
  );
}

export function Football({ rotate = -24 }: { rotate?: number }) {
  return (
    <g transform={`rotate(${rotate})`}>
      <ellipse cx="0" cy="0" rx="26" ry="16" fill={BALL} />
      <path d="M-14 0 H14" stroke={LACE} strokeWidth="1.6" />
      <path d="M-6 -7 V7 M-1 -9 V9 M4 -7 V7" stroke={LACE} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}
