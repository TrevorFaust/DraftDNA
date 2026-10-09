import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import {
  BLUE,
  BODY_PIVOT,
  BACK_HIP,
  FAR_SHOULDER,
  FRONT_HIP,
  Football,
  Leg,
  SHIN,
  NEAR_SHOULDER,
  PlayerShell,
  SKIN,
  WHITE,
  footTarget,
  solveLeg,
  svgRotate,
} from '@/components/footballKit';

/** Running stride, in viewBox units, locked to the same ground speed as the board. */
export const RUNNER_STEP = 104;
export const RUNNER_VIEW_W = 280;

const LEAN = 16;
const LIFT = 54;

export type BallRunnerHandle = {
  setPose: (traveledPx: number, svgPerPx: number) => void;
};

function applyPose(
  nodes: {
    backThigh: SVGGElement | null;
    backShin: SVGGElement | null;
    backCleat: SVGGElement | null;
    frontThigh: SVGGElement | null;
    frontShin: SVGGElement | null;
    frontCleat: SVGGElement | null;
    bob: SVGGElement | null;
    nearArm: SVGGElement | null;
    farArm: SVGGElement | null;
  },
  traveledPx: number,
  svgPerPx: number,
) {
  const stepPx = RUNNER_STEP / Math.max(svgPerPx, 0.0001);
  const cycle = ((traveledPx / stepPx) % 2 + 2) % 2;
  const hipDrop = Math.sin(cycle * Math.PI * 2) * 10;
  nodes.bob?.setAttribute('transform', `translate(0 ${hipDrop.toFixed(2)})`);

  const plant = (
    hip: { x: number; y: number },
    phase: number,
    thigh: SVGGElement | null,
    shin: SVGGElement | null,
    cleat: SVGGElement | null,
  ) => {
    const solved = solveLeg(hip, footTarget(phase, hip, hipDrop, RUNNER_STEP, LIFT));
    thigh?.setAttribute('transform', `rotate(${solved.thighDeg.toFixed(2)})`);
    shin?.setAttribute('transform', `rotate(${solved.shinDeg.toFixed(2)})`);
    cleat?.setAttribute('transform', `translate(0 ${SHIN}) rotate(${solved.cleatDeg.toFixed(2)})`);
  };
  plant(BACK_HIP, cycle + 1, nodes.backThigh, nodes.backShin, nodes.backCleat);
  plant(FRONT_HIP, cycle, nodes.frontThigh, nodes.frontShin, nodes.frontCleat);

  const pump = Math.cos(cycle * Math.PI * 2);
  const near = svgRotate(NEAR_SHOULDER, BODY_PIVOT, LEAN);
  const far = svgRotate(FAR_SHOULDER, BODY_PIVOT, LEAN);
  nodes.nearArm?.setAttribute(
    'transform',
    `translate(${near.x.toFixed(2)} ${near.y.toFixed(2)}) rotate(${(pump * 46).toFixed(2)})`,
  );
  nodes.farArm?.setAttribute(
    'transform',
    `translate(${far.x.toFixed(2)} ${far.y.toFixed(2)}) rotate(${(28 - pump * 16).toFixed(2)})`,
  );
}

/** Ball carrier in the same kit, running in the open ahead of the board. */
export const BallRunner = forwardRef<BallRunnerHandle>(function BallRunner(_, ref) {
  const bobRef = useRef<SVGGElement>(null);
  const backThighRef = useRef<SVGGElement>(null);
  const backShinRef = useRef<SVGGElement>(null);
  const backCleatRef = useRef<SVGGElement>(null);
  const frontThighRef = useRef<SVGGElement>(null);
  const frontShinRef = useRef<SVGGElement>(null);
  const frontCleatRef = useRef<SVGGElement>(null);
  const nearArmRef = useRef<SVGGElement>(null);
  const farArmRef = useRef<SVGGElement>(null);

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
        nearArm: nearArmRef.current,
        farArm: farArmRef.current,
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
    <svg viewBox="0 0 280 490" className="h-full w-full overflow-visible" aria-hidden="true">
      <g ref={bobRef}>
        <Leg hip={BACK_HIP} thighRef={backThighRef} shinRef={backShinRef} cleatRef={backCleatRef} />
        <g transform={`rotate(${LEAN} ${BODY_PIVOT.x} ${BODY_PIVOT.y})`}>
          <PlayerShell number="17" />
        </g>
        <Leg hip={FRONT_HIP} thighRef={frontThighRef} shinRef={frontShinRef} cleatRef={frontCleatRef} />
        <g ref={farArmRef}>
          <line x1="0" y1="0" x2="-8" y2="36" stroke={WHITE} strokeWidth="28" strokeLinecap="round" />
          <line x1="-6" y1="28" x2="-36" y2="58" stroke={SKIN} strokeWidth="18" strokeLinecap="round" />
          <g transform="translate(-52 64)">
            <Football rotate={-18} />
          </g>
          <ellipse cx="-34" cy="66" rx="16" ry="13" fill={BLUE} />
        </g>
        <g ref={nearArmRef}>
          <line x1="0" y1="0" x2="16" y2="34" stroke={WHITE} strokeWidth="26" strokeLinecap="round" />
          <line x1="12" y1="26" x2="42" y2="62" stroke={SKIN} strokeWidth="16" strokeLinecap="round" />
          <ellipse cx="48" cy="70" rx="16" ry="13" fill={BLUE} />
        </g>
      </g>
    </svg>
  );
});
