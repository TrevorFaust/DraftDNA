import { cn } from '@/lib/utils';
import { SiteLogo } from '@/components/SiteLogo';

interface BrandedLoaderProps {
  className?: string;
  logoClassName?: string;
  size?: number;
  label?: string;
  /** @deprecated No longer used — 3D loaders caused WebGL context thrash on every page. */
  force3D?: boolean;
}

/**
 * Lightweight CSS spinner using the site logo.
 * Do not use Three.js here — each Canvas allocated a WebGL context and navigation
 * was losing contexts (`THREE.WebGLRenderer: Context Lost`) and stalling the UI.
 */
export const BrandedLoader = ({
  className,
  logoClassName,
  size = 48,
  label,
}: BrandedLoaderProps) => {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)} role="status" aria-live="polite">
      <div className={cn('shrink-0', logoClassName)}>
        <SiteLogo
          size={size}
          className="animate-spin [animation-duration:0.85s] object-contain"
        />
      </div>
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
      <span className="sr-only">{label ?? 'Loading'}</span>
    </div>
  );
};
