import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BallSpinSequence } from '@/components/BallSpinSequence';
import { cn } from '@/lib/utils';

const ENTERED_KEY = 'draftdna_entered';

type Phase = 'spin' | 'show' | 'gone';

/** Skip the title card when an auth redirect lands on the site root. */
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

function hasEntered(): boolean {
  try {
    return localStorage.getItem(ENTERED_KEY) === '1';
  } catch {
    return false;
  }
}

function markEntered(): void {
  try {
    localStorage.setItem(ENTERED_KEY, '1');
  } catch {
    /* private mode */
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initialPhase(): Phase {
  if (!isPlainHomeLoad() || hasEntered()) return 'gone';
  if (prefersReducedMotion()) return 'show';
  return 'spin';
}

/**
 * First-load intro: a sketch football spins on a tip, wobbles out, then the title card.
 */
export function SiteEntrance({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const shellRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const enteredRef = useRef(false);

  const finish = useCallback(() => {
    setPhase('gone');
  }, []);

  const skip = useCallback(() => {
    enteredRef.current = true;
    markEntered();
    finish();
  }, [finish]);

  const reveal = useCallback(() => {
    setPhase('show');
  }, []);

  const enter = useCallback(() => {
    if (enteredRef.current) return;
    enteredRef.current = true;
    markEntered();
    finish();
  }, [finish]);

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
    if (phase === 'show') buttonRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        skip();
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        if (phase === 'show') buttonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, skip]);

  useEffect(() => {
    if (phase !== 'gone' || !enteredRef.current) return;
    document.getElementById('site-main')?.focus({ preventScroll: true });
  }, [phase]);

  const cardUp = phase === 'show';
  const showBall = phase === 'spin' || cardUp;

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
          className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-background"
          onClick={phase === 'spin' ? reveal : undefined}
        >
          <div className="position-rail shrink-0" aria-hidden />
          <div className="desk-grain pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative z-10 flex flex-1 flex-col items-center overflow-visible px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-center">
            <div
              className={cn(
                'entrance-masthead my-auto flex w-full flex-col items-center',
                cardUp && 'is-set',
              )}
            >
              {showBall ? (
                <BallSpinSequence compact={cardUp} frozen={cardUp} onLanded={reveal} />
              ) : null}
              {cardUp ? (
                <div className="flex w-full flex-col items-center">
                  <h1
                    id="site-entrance-title"
                    className="font-editorial mt-2 text-[clamp(4.25rem,min(13vw,22dvh),7.75rem)] font-medium leading-[0.84] tracking-[-0.03em] hero-rise sm:mt-3"
                  >
                    <span className="melt-draft">Draft</span>
                    <span className="melt-dna italic">DNA</span>
                  </h1>
                  <div
                    className="hero-rule hero-rule-center mt-6 hero-rise"
                    style={{ animationDelay: '80ms' }}
                  />
                  <p
                    id="site-entrance-slogan"
                    className="mt-5 max-w-xs text-base leading-relaxed text-foreground/80 hero-rise sm:text-lg"
                    style={{ animationDelay: '140ms' }}
                  >
                    Put your players in order.
                  </p>
                  <div className="mt-8 hero-rise" style={{ animationDelay: '220ms' }}>
                    <Button
                      ref={buttonRef}
                      type="button"
                      variant="hero"
                      size="lg"
                      className="min-h-12 touch-manipulation gap-2 px-6"
                      onClick={(event) => {
                        event.stopPropagation();
                        enter();
                      }}
                    >
                      Get on the board
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
