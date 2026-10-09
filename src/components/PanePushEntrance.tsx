import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BallRunner, RUNNER_VIEW_W, type BallRunnerHandle } from '@/components/BallRunner';
import { PanePusher, PUSHER_VIEW_W, type PanePusherHandle } from '@/components/PanePusher';

type Phase = 'push' | 'gone';

const DURATION_MS = 6400;
const HOLD = 0.1;

/** Skip the wipe when an auth redirect lands on the site root. */
function isPlainHomeLoad(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  if (path !== '/' && path !== '') return false;
  const hash = window.location.hash;
  const search = window.location.search;
  if (/access_token|error=|type=/.test(hash)) return false;
  if (/[?&](code|error)=/.test(search)) return false;
  return true;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initialPhase(): Phase {
  if (!isPlainHomeLoad() || prefersReducedMotion()) return 'gone';
  return 'push';
}

function pushProgress(t: number): number {
  if (t <= HOLD) return 0;
  const p = (t - HOLD) / (1 - HOLD);
  return p * p * (3 - 2 * p);
}

function rigTravel(width: number, groupWidth: number) {
  const bleed = 56;
  return {
    bleed,
    startX: -bleed,
    endX: width + groupWidth + 20,
    rigWidth: width + bleed,
  };
}

/**
 * First-load wipe: a ball carrier runs in the open while a lineman pushes the board.
 * Plays on every fresh load of the home page so the motion can be tuned.
 * The football intro is unchanged; switch back in entranceMode.ts.
 */
export function PanePushEntrance({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const shellRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const runnerBoxRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pusherRef = useRef<PanePusherHandle>(null);
  const runnerRef = useRef<BallRunnerHandle>(null);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('gone');
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (phase === 'gone') {
      shell.removeAttribute('inert');
      return;
    }
    shell.setAttribute('inert', '');
    return () => shell.removeAttribute('inert');
  }, [phase]);

  useEffect(() => {
    if (phase === 'gone') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'push') return;
    buttonRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        buttonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, finish]);

  useEffect(() => {
    if (phase !== 'gone' || !doneRef.current) return;
    document.getElementById('site-main')?.focus({ preventScroll: true });
  }, [phase]);

  useLayoutEffect(() => {
    if (phase !== 'push') return;
    const rig = rigRef.current;
    const group = groupRef.current;
    if (!rig || !group) return;
    const width = rig.parentElement?.clientWidth ?? window.innerWidth;
    const travel = rigTravel(width, group.offsetWidth || 640);
    rig.style.width = `${travel.rigWidth}px`;
    rig.style.transform = `translate3d(${travel.startX}px,0,0)`;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'push') return;
    const rig = rigRef.current;
    if (!rig) return;

    let frame = 0;
    let cancelled = false;
    const started = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - started) / DURATION_MS);
      const u = pushProgress(t);
      const width = rig.parentElement?.clientWidth ?? window.innerWidth;
      const groupWidth = Math.max(groupRef.current?.offsetWidth ?? 640, 1);
      const figureWidth = Math.max(figureRef.current?.offsetWidth ?? 400, 1);
      const runnerWidth = Math.max(runnerBoxRef.current?.offsetWidth ?? 280, 1);
      const travel = rigTravel(width, groupWidth);
      const x = travel.startX + u * (travel.endX - travel.startX);
      const traveled = x - travel.startX;
      rig.style.width = `${travel.rigWidth}px`;
      rig.style.transform = `translate3d(${x}px,0,0)`;
      pusherRef.current?.setPose(traveled, PUSHER_VIEW_W / figureWidth);
      runnerRef.current?.setPose(traveled, RUNNER_VIEW_W / runnerWidth);

      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        finish();
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [phase, finish]);

  return (
    <>
      <div ref={shellRef}>{children}</div>
      {phase === 'push' ? (
        <div className="fixed inset-0 z-[80] overflow-hidden" onClick={finish}>
          <p className="sr-only" role="status">
            A ball carrier runs ahead of a lineman pushing the sideline board aside.
          </p>
          <div
            ref={rigRef}
            className="absolute inset-y-0 left-0 w-full will-change-transform"
            aria-hidden="true"
          >
            <div
              className="absolute inset-0 z-20"
              style={{
                backgroundColor: '#f3eee4',
                backgroundImage:
                  'radial-gradient(rgba(28,25,22,0.055) 0.65px, transparent 0.75px)',
                backgroundSize: '3px 3px',
                boxShadow: '-18px 0 28px rgba(12,10,8,0.45)',
              }}
            />
            <div className="pointer-events-none absolute inset-0 z-20 flex">
              {['10', '20', '30', '40', '50'].map((yard) => (
                <div
                  key={yard}
                  className="flex h-full flex-1 items-end border-l border-[#1c1916]/10 pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-3"
                >
                  <span className="font-editorial text-3xl italic leading-none text-[#1c1916]/20 sm:text-5xl">
                    {yard}
                  </span>
                </div>
              ))}
            </div>
            <div className="absolute inset-y-0 left-0 z-20 w-4 bg-[#3a2c22]" />
            <div className="absolute inset-y-0 left-4 z-20 w-1.5 bg-[#2f5d46]" />
            <div className="absolute inset-y-0 left-[1.35rem] z-20 w-px bg-[#f4efe6]/35" />

            <div
              ref={groupRef}
              className="absolute bottom-0 left-0 z-30 flex items-end gap-3"
              style={{ transform: 'translateX(-100%)' }}
            >
              <div ref={runnerBoxRef} className="h-[min(68vh,540px)] aspect-[280/490]">
                <BallRunner ref={runnerRef} />
              </div>
                <div className="h-[min(68vh,540px)] overflow-hidden">
                <div ref={figureRef} className="h-full aspect-[400/490] translate-x-[6%]">
                  <PanePusher ref={pusherRef} />
                </div>
              </div>
            </div>
          </div>

          <button
            ref={buttonRef}
            type="button"
            className="fixed z-[81] min-h-11 rounded-full border border-[#1c1916]/15 bg-[#f4efe6] px-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#1c1916] shadow-[0_8px_24px_rgba(0,0,0,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5d46]"
            style={{
              top: 'max(0.85rem, env(safe-area-inset-top))',
              right: 'max(0.85rem, env(safe-area-inset-right))',
            }}
            onClick={(event) => {
              event.stopPropagation();
              finish();
            }}
          >
            Skip
          </button>
        </div>
      ) : null}
    </>
  );
}
