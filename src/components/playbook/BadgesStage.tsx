import { useEffect, useMemo, useState } from 'react';
import {
  ARCHETYPE_BADGE_FILENAME_BY_NAME,
  getArchetypeBadgePublicUrl,
} from '@/constants/archetypeBadgeAssets.generated';
import { prefersReducedMotion } from '@/components/landing/landingBoard';

const LOCKED_SRC = '/badges/locked.png';
const NAMES = Object.keys(ARCHETYPE_BADGE_FILENAME_BY_NAME).filter((_, index) => index % 12 === 0);
const ROWS = 6;

type Cell = { name: string; locked: boolean };

function useColumnCount() {
  const [cols, setCols] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches ? 4 : 5
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const apply = () => setCols(media.matches ? 4 : 5);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  return cols;
}

function buildRows(cols: number): Cell[][] {
  let cursor = 0;
  return Array.from({ length: ROWS }, () => {
    const unlocked = 2 + Math.floor(Math.random() * (cols - 2));
    const flags = Array.from({ length: cols }, (_, index) => index < unlocked);
    for (let i = flags.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [flags[i], flags[j]] = [flags[j], flags[i]];
    }
    return flags.map((open) => {
      const name = NAMES[cursor % NAMES.length];
      cursor += 1;
      return { name, locked: !open };
    });
  });
}

function BadgeCell({ cell }: { cell: Cell }) {
  const [failed, setFailed] = useState(false);
  const art = getArchetypeBadgePublicUrl(cell.name);
  const src = cell.locked || !art || failed ? LOCKED_SRC : art;

  return (
    <img
      src={src}
      alt=""
      width={160}
      height={160}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className="h-auto w-full object-contain"
    />
  );
}

function BadgeGrid({ rows }: { rows: Cell[][] }) {
  const cols = rows[0]?.length ?? 5;
  return (
    <div className="flex flex-col gap-2 px-3 sm:px-4">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {row.map((cell, index) => (
            <BadgeCell key={`${rowIndex}-${cell.name}-${index}`} cell={cell} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Down the badge wall, four or five across, with locked slots in every row. */
export function BadgesStage() {
  const cols = useColumnCount();
  const rows = useMemo(() => buildRows(cols), [cols]);
  const [reduce] = useState(prefersReducedMotion);

  return (
    <div className="relative h-full min-h-0 overflow-hidden" aria-hidden>
      <div className={reduce ? 'relative py-3' : 'badge-vscroll absolute inset-x-0 top-0'}>
        <div className="pb-3 pt-3">
          <BadgeGrid rows={rows} />
        </div>
        {reduce ? null : (
          <div className="pb-3">
            <BadgeGrid rows={rows} />
          </div>
        )}
      </div>
    </div>
  );
}
