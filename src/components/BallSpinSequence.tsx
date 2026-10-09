import { useEffect, useRef, useState } from 'react';
import { SketchBall } from '@/components/SketchBall';

const FPS = 30;
const STEP = Math.PI / 10;
const W0 = 11 * Math.PI * 2;
const DECAY = 0.7;
const FALL_AT = 3.2;
const REST_AT = 3.95;
const LAND_AT = 4.2;
const REST_SPIN = Math.PI / 2;
const REST: Pose = { spin: REST_SPIN, tilt: 90, azimuth: 90 };

type Pose = {
  spin: number;
  tilt: number;
  azimuth: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function spinAngle(t: number) {
  return (W0 / DECAY) * (1 - Math.exp(-DECAY * t));
}

function nearestSpin(from: number, to: number) {
  const tau = Math.PI * 2;
  return to + Math.round((from - to) / tau) * tau;
}

function lerpDeg(from: number, to: number, k: number) {
  let delta = ((to - from) % 360 + 360) % 360;
  if (delta > 180) delta -= 360;
  return from + delta * k;
}

function poseAt(time: number): Pose {
  const t = Math.min(REST_AT, Math.max(0, time));
  if (t >= REST_AT) return REST;

  let spin = Math.round(spinAngle(t) / STEP) * STEP;
  let azimuth = t * 42;

  let tilt = 7;
  if (t < 2.45) {
    tilt = 7 + 6 * (t / 2.45);
  } else if (t < FALL_AT) {
    const u = (t - 2.45) / (FALL_AT - 2.45);
    tilt = 13 + 16 * u * u;
    const w = clamp((t - 2.45) / 0.2, 0, 1) * clamp((FALL_AT - t) / 0.12, 0, 1);
    tilt += Math.sin(t * 13) * 3.4 * w;
  } else {
    const u = clamp((t - FALL_AT) / (REST_AT - FALL_AT), 0, 1);
    const ease = 0.7 * u + 0.3 * u * u;
    tilt = 29 + 61 * ease;
    azimuth = lerpDeg(FALL_AT * 42, 90, ease);
    const target = nearestSpin(spin, REST_SPIN);
    spin = Math.round((spin * (1 - ease) + target * ease) / STEP) * STEP;
  }

  return { spin, tilt, azimuth };
}

/** Sketch ball-spin on the desk. Stands on a tip, then tips over like the DaVinci clip. */
export function BallSpinSequence({
  compact,
  frozen,
  onLanded,
}: {
  compact?: boolean;
  frozen?: boolean;
  onLanded?: () => void;
}) {
  const [pose, setPose] = useState<Pose>(frozen ? REST : poseAt(0));
  const landedRef = useRef(frozen ?? false);
  const onLandedRef = useRef(onLanded);
  onLandedRef.current = onLanded;

  useEffect(() => {
    if (frozen) {
      setPose(REST);
      return;
    }
    let frame = 0;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const stepMs = 1000 / FPS;

    const tick = (now: number) => {
      acc += Math.min(now - last, 48);
      last = now;
      while (acc >= stepMs && !landedRef.current) {
        acc -= stepMs;
        frame += 1;
        const t = frame / FPS;
        setPose(poseAt(t));
        if (t >= LAND_AT) {
          landedRef.current = true;
          onLandedRef.current?.();
        }
      }
      if (!landedRef.current) raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [frozen]);

  return (
    <div className={compact ? 'spin-ball-slot is-parked' : 'spin-ball-slot'} aria-hidden>
      <SketchBall
        spin={pose.spin}
        tilt={pose.tilt}
        azimuth={pose.azimuth}
        parked={compact}
        className="spin-ball-svg"
      />
    </div>
  );
}
