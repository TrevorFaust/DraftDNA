import { useEffect, useState, type CSSProperties } from 'react';
import { prefersReducedMotion } from './landingBoard';
import { useOnScreen } from './useOnScreen';

type Slate = { pos: string; heading: string; tiebreaker: string; six: string[] };

/** Sample slate, not anyone's entry: a top six for every position group. */
const SLATES: Slate[] = [
  {
    pos: 'QB',
    heading: 'Top QBs',
    tiebreaker: '4,780 pass yds',
    six: [
      'Josh Allen',
      'Lamar Jackson',
      'Drake Maye',
      'Joe Burrow',
      'Jalen Hurts',
      'Jayden Daniels',
    ],
  },
  {
    pos: 'RB',
    heading: 'Top RBs',
    tiebreaker: '1,615 rush yds',
    six: [
      'Jahmyr Gibbs',
      'Bijan Robinson',
      'Jonathan Taylor',
      'James Cook III',
      'Christian McCaffrey',
      'Saquon Barkley',
    ],
  },
  {
    pos: 'WR',
    heading: 'Top WRs',
    tiebreaker: '1,540 rec yds',
    six: [
      "Ja'Marr Chase",
      'Puka Nacua',
      'Jaxon Smith-Njigba',
      'CeeDee Lamb',
      'A.J. Brown',
      'Justin Jefferson',
    ],
  },
  {
    pos: 'TE',
    heading: 'Top TEs',
    tiebreaker: '1,120 rec yds',
    six: [
      'Trey McBride',
      'Brock Bowers',
      'Colston Loveland',
      'Tyler Warren',
      'George Kittle',
      'Sam LaPorta',
    ],
  },
  {
    pos: 'K',
    heading: 'Top kickers',
    tiebreaker: '38 field goals',
    six: [
      'Brandon Aubrey',
      'Cameron Dicker',
      'Chris Boswell',
      'Jake Bates',
      "Ka'imi Fairbairn",
      'Tyler Bass',
    ],
  },
  {
    pos: 'D/ST',
    heading: 'Top defenses',
    tiebreaker: '52 sacks',
    six: [
      'Denver Broncos',
      'Houston Texans',
      'Philadelphia Eagles',
      'Baltimore Ravens',
      'Minnesota Vikings',
      'Pittsburgh Steelers',
    ],
  },
];

/** The first slate again, so rolling past the last one lands on identical content. */
const TRACK = [...SLATES, SLATES[0]];

const HOLD_MS = 4200;
const ROLL_MS = 620;

/**
 * Decorative Pick Six slip. Each position group rolls out to the left as the next rolls
 * in from the right, and the dots track where you are in the six groups.
 */
export function PickSixSlip() {
  const { ref, onScreen } = useOnScreen<HTMLDivElement>();
  const [at, setAt] = useState(0);
  const [rolling, setRolling] = useState(true);

  useEffect(() => {
    if (!onScreen || prefersReducedMotion()) return;
    const timer = window.setInterval(() => setAt((prev) => prev + 1), HOLD_MS);
    return () => window.clearInterval(timer);
  }, [onScreen]);

  // Roll onto the duplicated first slate, then snap back with the roll switched off.
  useEffect(() => {
    if (at < SLATES.length) return;
    const snap = window.setTimeout(() => {
      setRolling(false);
      setAt(0);
      window.requestAnimationFrame(() => setRolling(true));
    }, ROLL_MS + 90);
    return () => window.clearTimeout(snap);
  }, [at]);

  const active = at % SLATES.length;

  return (
    <div ref={ref} className="landing-sim is-right" aria-hidden>
      <p className="landing-sim-label">
        <span className="landing-sim-dot" />
        Pick Six
        <span className="pick-slip-dots">
          {SLATES.map((slate, i) => (
            <span key={slate.pos} className="pick-slip-dot" data-on={i === active ? 'true' : undefined} />
          ))}
        </span>
      </p>
      <div className="pick-slip-window">
        <div
          className="pick-slip-track"
          style={{ '--at': at, '--rolling': rolling ? 1 : 0 } as CSSProperties}
        >
          {TRACK.map((slate, i) => (
            <div key={`${slate.pos}-${i}`} className="pick-slip-panel">
              <p className="pick-slip-pos">{slate.heading}</p>
              <ol className="pick-slip">
                {slate.six.map((name, rank) => (
                  <li key={name} className="pick-slip-row">
                    <span className="pick-slip-rank">{rank + 1}</span>
                    <span className="pick-slip-name">{name}</span>
                  </li>
                ))}
              </ol>
              <p className="pick-slip-foot">Tiebreaker · {slate.tiebreaker}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
