import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import {
  BLUE,
  BODY_PIVOT,
  BACK_HIP,
  FAR_SHOULDER,
  FRONT_HIP,
  Leg,
  SHIN,
  NEAR_SHOULDER,
  PlayerShell,
  SKIN,
  WHITE,
  footTarget,
  solveLeg,
  svgRotate,
  type Pt,
} from '@/components/footballKit';

/** Long push lunge, in viewBox units. The board travels this far each step. */
export const PUSHER_STEP = 128;
export const PUSHER_VIEW_W = 400;

const LEAN = 18;
const LIFT = 36;
const NEAR_HAND = { x: 368, y: 236 };
const FAR_HAND = { x: 352, y: 300 };

export type PanePusherHandle = {
  setPose: (traveledPx: number, svgPerPx: number) => void;
};

function setLine(line: SVGLineElement | null, from: Pt, to: Pt) {
  if (!line) return;
  line.setAttribute('x1', from.x.toFixed(2));
  line.setAttribute('y1', from.y.toFixed(2));
  line.setAttribute('x2', to.x.toFixed(2));
  line.setAttribute('y2', to.y.toFixed(2));
}

function mix(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function applyPose(
  nodes: {
    backThigh: SVGGElement | null;
    backShin: SVGGElement | null;
    backCleat: SVGGElement | null;
    frontThigh: SVGGElement | null;
    frontShin: SVGGElement | null;
    frontCleat: SVGGElement | null;
    bob: SVGGElement | null;
    nearSleeve: SVGLineElement | null;
    nearSkin: SVGLineElement | null;
    farSleeve: SVGLineElement | null;
    farSkin: SVGLineElement | null;
  },
  traveledPx: number,
  svgPerPx: number,
) {
  const stepPx = PUSHER_STEP / Math.max(svgPerPx, 0.0001);
  const cycle = ((traveledPx / stepPx) % 2 + 2) % 2;
  const hipDrop = 8 + Math.sin(cycle * Math.PI * 2) * 9;
  nodes.bob?.setAttribute('transform', `translate(0 ${hipDrop.toFixed(2)})`);

  const plant = (
    hip: Pt,
    phase: number,
    thigh: SVGGElement | null,
    shin: SVGGElement | null,
    cleat: SVGGElement | null,
  ) => {
    const solved = solveLeg(hip, footTarget(phase, hip, hipDrop, PUSHER_STEP, LIFT));
    thigh?.setAttribute('transform', `rotate(${solved.thighDeg.toFixed(2)})`);
    shin?.setAttribute('transform', `rotate(${solved.shinDeg.toFixed(2)})`);
    cleat?.setAttribute('transform', `translate(0 ${SHIN}) rotate(${solved.cleatDeg.toFixed(2)})`);
  };
  plant(BACK_HIP, cycle + 1, nodes.backThigh, nodes.backShin, nodes.backCleat);
  plant(FRONT_HIP, cycle, nodes.frontThigh, nodes.frontShin, nodes.frontCleat);

  const shoulder = (p: Pt) => {
    const leaned = svgRotate(p, BODY_PIVOT, LEAN);
    return { x: leaned.x, y: leaned.y + hipDrop };
  };
  const reach = (sleeve: SVGLineElement | null, skin: SVGLineElement | null, from: Pt, to: Pt) => {
    const wrist = mix(from, to, 0.9);
    setLine(sleeve, from, mix(from, to, 0.42));
    setLine(skin, mix(from, to, 0.34), wrist);
  };
  reach(nodes.farSleeve, nodes.farSkin, shoulder(FAR_SHOULDER), FAR_HAND);
  reach(nodes.nearSleeve, nodes.nearSkin, shoulder(NEAR_SHOULDER), NEAR_HAND);
}

/**
 * Lineman behind the board. Body stays back so both arms reach the wall.
 * Feet plant with the board so the lunges do not slide.
 */
export const PanePusher = forwardRef<PanePusherHandle>(function PanePusher(_, ref) {
  const bobRef = useRef<SVGGElement>(null);
  const backThighRef = useRef<SVGGElement>(null);
  const backShinRef = useRef<SVGGElement>(null);
  const backCleatRef = useRef<SVGGElement>(null);
  const frontThighRef = useRef<SVGGElement>(null);
  const frontShinRef = useRef<SVGGElement>(null);
  const frontCleatRef = useRef<SVGGElement>(null);
  const nearSleeveRef = useRef<SVGLineElement>(null);
  const nearSkinRef = useRef<SVGLineElement>(null);
  const farSleeveRef = useRef<SVGLineElement>(null);
  const farSkinRef = useRef<SVGLineElement>(null);

  const pose = (traveledPx: number, svgPerPx: number) => {
    applyPose(
      {
        backThigh: backThighRef.current,
        backShin: backShinRef.current,
        backCleat: backCleatRef.current,
        frontThigh: frontThighRef.current,
        frontShin: frontShinRef.current,
        frontCleat: frontCleatRef.current,
        bob: bobRef.current,
        nearSleeve: nearSleeveRef.current,
        nearSkin: nearSkinRef.current,
        farSleeve: farSleeveRef.current,
        farSkin: farSkinRef.current,
      },
      traveledPx,
      svgPerPx,
    );
  };

  useImperativeHandle(ref, () => ({ setPose: pose }));

  useLayoutEffect(() => {
    pose(0, 1);
  }, []);

  return (
    <svg viewBox="0 0 400 490" className="h-full w-full overflow-visible" aria-hidden="true">
      <g ref={bobRef}>
        <Leg hip={BACK_HIP} thighRef={backThighRef} shinRef={backShinRef} cleatRef={backCleatRef} />
        <g transform={`rotate(${LEAN} ${BODY_PIVOT.x} ${BODY_PIVOT.y})`}>
          <PlayerShell number="71" />
        </g>
        <Leg hip={FRONT_HIP} thighRef={frontThighRef} shinRef={frontShinRef} cleatRef={frontCleatRef} />
      </g>

      <line ref={farSleeveRef} stroke={WHITE} strokeWidth="34" strokeLinecap="round" />
      <line ref={farSkinRef} stroke={SKIN} strokeWidth="22" strokeLinecap="round" />
      <line ref={nearSleeveRef} stroke={WHITE} strokeWidth="36" strokeLinecap="round" />
      <line ref={nearSkinRef} stroke={SKIN} strokeWidth="24" strokeLinecap="round" />

      <ellipse cx={FAR_HAND.x} cy={FAR_HAND.y} rx="22" ry="18" fill={BLUE} />
      <ellipse cx={NEAR_HAND.x} cy={NEAR_HAND.y} rx="24" ry="18" fill={BLUE} />
      <path
        d={`M${NEAR_HAND.x - 8} ${NEAR_HAND.y - 2} h14 M${FAR_HAND.x - 6} ${FAR_HAND.y} h12`}
        fill="none"
        stroke="#d7e4fb"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
});
