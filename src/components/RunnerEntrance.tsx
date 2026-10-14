import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RunnerFigureHandle } from '@/components/RunnerFigure';
import { formatContestPrizeUsd, PICK_SIX_TOTAL_PRIZE_POOL_USD } from '@/constants/contest';
import { cn } from '@/lib/utils';

const RunnerFigure = lazy(() => import('@/components/RunnerFigure').then((m) => ({ default: m.RunnerFigure })));
const BagFigure = lazy(() => import('@/components/RunnerFigure').then((m) => ({ default: m.BagFigure })));

type Phase = 'run' | 'card' | 'gone';

const RUN_MS = 4800;
/** Soft leading edge of the black sheet, so letters do not cut on a hard line. */
const CURTAIN_FEATHER = 112;
/**
 * How long before his body reaches the middle of the bag the hop starts.
 * Jump peaks about 760ms in. Matching the lead to that peak keeps him
 * up over the back of the bag instead of coming down on it.
 */
const JUMP_LEAD_MS = 760;
/** Chest and feet sit to the right of the Player Build origin during the run. */
const BODY_AHEAD = 48;
/** Artboard is 600×840 so the jump has room above the helmet. */
const ART_W = 600;
const ART_H = 840;
const RUNNER_H = 'min(108vh, 980px)';

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
  if (!isPlainHomeLoad()) return 'gone';
  if (prefersReducedMotion()) return 'card';
  return 'run';
}

function track(viewWidth: number, canvasSize: number) {
  return {
    start: -canvasSize,
    end: viewWidth,
  };
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

/**
 * First-load intro: the running back crosses the field, then the Draft DNA
 * card fades in. Plays on every fresh load of the home page.
 * The other intros stay in the repo. Switch back in entranceMode.ts.
 */
export function RunnerEntrance({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [ready, setReady] = useState(false);
  const [bagIn, setBagIn] = useState(false);
  const [runGo, setRunGo] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const runnerRef = useRef<HTMLDivElement>(null);
  const bagRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const figureRef = useRef<RunnerFigureHandle>(null);
  const playerArtX = useRef(125);
  const bagArtX = useRef(300);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('gone');
  }, []);

  const showCard = useCallback(() => {
    setPhase('card');
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
    if (phase === 'gone') return;
    if (phase === 'card') buttonRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        if (phase === 'card') buttonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, finish]);

  useEffect(() => {
    if (phase !== 'gone' || !doneRef.current) return;
    document.getElementById('site-main')?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    if (phase !== 'run' || ready) return;
    const id = window.setTimeout(showCard, 8000);
    return () => window.clearTimeout(id);
  }, [phase, ready, showCard]);

  useLayoutEffect(() => {
    if (phase !== 'run') return;
    const runner = runnerRef.current;
    if (!runner) return;
    const view = fieldRef.current?.clientWidth ?? window.innerWidth;
    const size = runner.offsetWidth;
    const start = size > 8 ? track(view, size).start - 32 : -window.innerWidth * 1.25;
    runner.style.transform = `translate3d(${start}px,0,0)`;
  }, [phase, ready]);

  useEffect(() => {
    if (phase !== 'run' || !ready || !bagIn) return;
    setRunGo(true);
  }, [phase, ready, bagIn]);

  useEffect(() => {
    if (phase !== 'run' || !runGo) return;
    const runner = runnerRef.current;
    if (!runner) return;

    let frame = 0;
    let cancelled = false;
    let jumped = false;
    const started = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - started;
      const view = fieldRef.current?.clientWidth ?? window.innerWidth;
      const size = runner.offsetWidth || 1;
      const { start, end } = track(view, size);
      const t = Math.min(1, elapsed / RUN_MS);
      const x = start + t * (end - start);
      runner.style.transform = `translate3d(${x}px,0,0)`;

      const playerCenter = x + size / 2;
      const speed = (end - start) / RUN_MS;
      const bodyScreen = x + ((playerArtX.current + BODY_AHEAD) / ART_W) * size;
      const bagScreen = (view - size) / 2 + (bagArtX.current / ART_W) * size;
      if (!jumped && bodyScreen >= bagScreen - speed * JUMP_LEAD_MS) {
        jumped = true;
        figureRef.current?.jump();
      }

      // The black sheet sits behind him and slides off to the right with him.
      const edge = Math.max(0, playerCenter - size * 0.04);
      if (curtainRef.current) {
        curtainRef.current.style.transform = `translate3d(${edge}px,0,0)`;
      }

      // Uncover starts as he reaches the title. The words keep fading
      // after the sheet has already moved past them.
      const fadeStart = view / 2 - size * 0.02;
      const fadeEnd = view / 2 + Math.max(size * 0.58, view * 0.34);
      const fadeT = smoothstep(
        Math.min(1, Math.max(0, (playerCenter - fadeStart) / (fadeEnd - fadeStart))),
      );
      if (cardRef.current) cardRef.current.style.opacity = String(fadeT);

      // The bag fades into the black as he leaves, instead of vanishing with the frame.
      const leaveStart = view * 0.58;
      const leaveEnd = view + size * 0.05;
      const leaveT = smoothstep(
        Math.min(1, Math.max(0, (playerCenter - leaveStart) / (leaveEnd - leaveStart))),
      );
      if (bagRef.current) bagRef.current.style.opacity = String(1 - leaveT);

      if (fadeT < 1 || t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setPhase('card');
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [phase, runGo]);

  const cardUp = phase === 'card';

  return (
    <>
      <div ref={shellRef}>{children}</div>
      {phase !== 'gone' ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={cardUp ? 'site-entrance-title' : undefined}
          aria-label={cardUp ? undefined : 'Draft DNA'}
          aria-describedby={cardUp ? 'site-entrance-slogan' : undefined}
          className="fixed inset-0 z-[80] overflow-hidden bg-background"
        >
          {phase === 'run' ? (
            <div
              ref={curtainRef}
              className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-full will-change-transform"
              style={{
                background: `linear-gradient(90deg, transparent 0px, hsl(var(--background)) ${CURTAIN_FEATHER}px, hsl(var(--background)) 100%)`,
              }}
              aria-hidden
            />
          ) : null}

          {phase === 'run' ? (
            <div ref={fieldRef} className="absolute inset-0 z-[2] overflow-hidden">
              <p className="sr-only" role="status">
                A running back jumps an agility bag.
              </p>
              <div
                ref={bagRef}
                className="pointer-events-none absolute left-1/2"
                style={{
                  height: RUNNER_H,
                  width: `calc(${RUNNER_H} * ${ART_W} / ${ART_H})`,
                  bottom: `calc(${RUNNER_H} * -0.08)`,
                  transform: 'translateX(-50%)',
                  opacity: bagIn ? 1 : 0,
                  transition: runGo ? undefined : 'opacity 280ms ease-out',
                }}
                aria-hidden
              >
                <Suspense fallback={null}>
                  <BagFigure
                    onPlace={(artX) => { bagArtX.current = artX; }}
                    onShown={() => setBagIn(true)}
                  />
                </Suspense>
              </div>
              <div
                ref={runnerRef}
                className="absolute left-0 z-[1] will-change-transform"
                style={{
                  height: RUNNER_H,
                  width: `calc(${RUNNER_H} * ${ART_W} / ${ART_H})`,
                  bottom: `calc(${RUNNER_H} * -0.08)`,
                }}
                aria-hidden="true"
              >
                <Suspense fallback={null}>
                  <RunnerFigure
                    ref={figureRef}
                    onReady={(artX) => {
                      playerArtX.current = artX;
                      setReady(true);
                    }}
                    onFail={showCard}
                  />
                </Suspense>
              </div>
            </div>
          ) : null}

          <div
            ref={cardRef}
            aria-hidden={cardUp ? undefined : true}
            className={cn(
              'absolute inset-0 flex flex-col overflow-hidden bg-background',
              cardUp ? 'z-[3] pointer-events-auto' : 'z-0 pointer-events-none',
            )}
            style={{ opacity: cardUp ? 1 : 0 }}
          >
            <div className="position-rail shrink-0" aria-hidden />
            <div className="desk-grain pointer-events-none absolute inset-0" aria-hidden />
            <div className="relative z-10 flex flex-1 flex-col items-center overflow-visible px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-center">
              <div className="entrance-masthead is-set my-auto flex w-full flex-col items-center">
                <h1
                  id="site-entrance-title"
                  className="entrance-wordmark font-masthead mt-2 text-[clamp(4.25rem,min(13vw,22dvh),7.75rem)] font-medium italic leading-[0.84] sm:mt-3"
                >
                  <span className="melt-draft">Draft</span>
                  <span className="melt-dna">DNA</span>
                  <span className="masthead-glint" aria-hidden="true">DraftDNA</span>
                </h1>
                <div className="entrance-rule" aria-hidden>
                  <span />
                  <span />
                  <span />
                </div>
                <p id="site-entrance-slogan" className="entrance-slogan">
                  <span>Build your board, mock the draft, and put six players on the line for a share of</span>
                  <span className="entrance-prize">{formatContestPrizeUsd(PICK_SIX_TOTAL_PRIZE_POOL_USD)}</span>
                </p>
                <div className="mt-8">
                  <Button
                    ref={buttonRef}
                    type="button"
                    variant="hero"
                    size="lg"
                    className="min-h-12 touch-manipulation gap-2 px-6"
                    tabIndex={cardUp ? 0 : -1}
                    onClick={(event) => {
                      event.stopPropagation();
                      finish();
                    }}
                  >
                    Get on the board
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
