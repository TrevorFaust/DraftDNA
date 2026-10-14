import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import riveWasmUrl from '@rive-app/canvas/rive.wasm?url';
import {
  Alignment,
  Fit,
  Layout,
  RuntimeLoader,
  useRive,
} from '@rive-app/react-canvas';

RuntimeLoader.setWasmUrl(riveWasmUrl);

const layout = new Layout({
  fit: Fit.Contain,
  alignment: Alignment.Center,
});

const ARTBOARD = 'RB Run & Jump';
const PLAYER_NODE = 'Player Build';
const RIV_SRC = '/running_and_jumping.riv?bag=13';

export type RunnerFigureHandle = {
  jump: () => void;
};

/**
 * The running back from the Rive file. The artboard fill is left out of
 * public/running_and_jumping.riv so the page background shows through.
 * Re-exporting from the editor with that fill visible paints a square behind him.
 */
export const RunnerFigure = forwardRef<
  RunnerFigureHandle,
  { onReady: (playerArtX: number) => void; onFail: () => void }
>(function RunnerFigure({ onReady, onFail }, ref) {
  const readyRef = useRef(onReady);
  const failRef = useRef(onFail);
  readyRef.current = onReady;
  failRef.current = onFail;
  const settled = useRef(false);

  const { rive, canvas, RiveComponent } = useRive(
    {
      src: RIV_SRC,
      artboard: ARTBOARD,
      autoplay: false,
      layout,
      shouldDisableRiveListeners: true,
      useOffscreenRenderer: false,
      onLoadError: () => {
        if (settled.current) return;
        settled.current = true;
        failRef.current();
      },
    },
    {
      useOffscreenRenderer: false,
      // He starts off the left edge. The default observer pauses drawing there
      // and the canvas stays on the Rive loading logo.
      shouldUseIntersectionObserver: false,
    },
  );

  const riveRef = useRef(rive);
  riveRef.current = rive;

  useImperativeHandle(ref, () => ({
    jump() {
      const live = riveRef.current;
      if (!live) return;
      // The state machine paints the Rive loading mark for a couple of seconds.
      // Scrub the jump clip instead, at the same 0.55 pace as the state.
      live.stop('Run');
      live.play('Jump');
      const duration = 0.833;
      const wall = (duration / 0.55) * 1000;
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - started) / wall);
        live.scrub('Jump', t * duration);
        live.drawFrame();
        if (t < 1) {
          requestAnimationFrame(step);
          return;
        }
        live.stop('Jump');
        live.play('Run');
      };
      requestAnimationFrame(step);
    },
  }), []);

  useEffect(() => {
    if (!rive || !canvas || settled.current) return;
    let frame = 0;
    let ticks = 0;

    const tick = () => {
      if (settled.current) return;
      ticks += 1;
      if (ticks === 1) rive.resizeToCanvas();
      rive.drawFrame();
      const seen = sampleCanvas(canvas);
      if (seen !== 'player' && ticks < 90) {
        frame = requestAnimationFrame(tick);
        return;
      }
      rive.play('Run');
      settled.current = true;
      readyRef.current(nodeArtX(rive, PLAYER_NODE) || 125);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rive, canvas]);

  return <RiveComponent className="h-full w-full bg-transparent" />;
});

function sampleCanvas(canvas: HTMLCanvasElement): 'player' | 'blank' | 'empty' {
  if (canvas.width < 8 || canvas.height < 8) return 'empty';
  const probe = document.createElement('canvas');
  probe.width = 10;
  probe.height = 10;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 'empty';

  let opaque = 0;
  const spots: Array<[number, number]> = [
    [0.42, 0.42],
    [0.5, 0.5],
    [0.58, 0.58],
    [0.48, 0.62],
  ];

  for (const [u, v] of spots) {
    ctx.clearRect(0, 0, 10, 10);
    ctx.drawImage(
      canvas,
      canvas.width * u - 5,
      canvas.height * v - 5,
      10,
      10,
      0,
      0,
      10,
      10,
    );
    const data = ctx.getImageData(0, 0, 10, 10).data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 180) continue;
      opaque += 1;
      const cream = r > 170 && g > 145 && b > 110 && r > b + 18;
      const green = g > 50 && g > r + 10 && g >= b && r < 150;
      const skin = r > 50 && r < 150 && g > 30 && g < 120 && b < 80 && r > g && g > b;
      if (cream || green || skin) return 'player';
    }
  }
  return opaque > 0 ? 'blank' : 'empty';
}

type RiveNode = { x: number; scaleX: number; scaleY: number };
type LiveArtboard = {
  node: (nodeName: string) => RiveNode | null;
};

function liveArtboard(rive: object | null) {
  return (rive as { artboard?: LiveArtboard } | null)?.artboard ?? null;
}

function hideNode(rive: object | null, name: string) {
  const node = liveArtboard(rive)?.node(name);
  if (!node) return;
  node.scaleX = 0;
  node.scaleY = 0;
}

function nodeArtX(rive: object | null, name: string) {
  return liveArtboard(rive)?.node(name)?.x ?? 0;
}

/**
 * The site file stores the bag at scale 0 so it does not ride with him.
 * This copy restores the size from the editor and keeps the position he set.
 */
function placeBag(rive: object | null) {
  const bag = liveArtboard(rive)?.node('Agility Bag');
  if (!bag) return null;
  bag.scaleX = 1;
  bag.scaleY = 1;
  return bag.x;
}

/** The agility bag from the same file, with the running back scaled away. */
export function BagFigure({
  onPlace,
  onShown,
}: {
  onPlace?: (artX: number) => void;
  onShown?: () => void;
}) {
  const [shown, setShown] = useState(false);
  const onPlaceRef = useRef(onPlace);
  const onShownRef = useRef(onShown);
  onPlaceRef.current = onPlace;
  onShownRef.current = onShown;
  const { rive, RiveComponent } = useRive(
    {
      src: RIV_SRC,
      artboard: ARTBOARD,
      autoplay: false,
      layout,
      shouldDisableRiveListeners: true,
      useOffscreenRenderer: false,
    },
    { useOffscreenRenderer: false },
  );

  useEffect(() => {
    if (!rive) return;
    const artX = placeBag(rive);
    hideNode(rive, PLAYER_NODE);
    rive.drawFrame();
    if (artX != null) onPlaceRef.current?.(artX);
    onShownRef.current?.();
    setShown(true);
  }, [rive]);

  return (
    <RiveComponent className={shown ? 'h-full w-full bg-transparent' : 'h-full w-full bg-transparent opacity-0'} />
  );
}
