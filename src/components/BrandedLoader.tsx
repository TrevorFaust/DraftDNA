import { lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { SiteLogo } from '@/components/SiteLogo';

const LazyDNALoader = lazy(() => import('@/components/DNALoader'));

interface BrandedLoaderProps {
  className?: string;
  logoClassName?: string;
  size?: number;
  label?: string;
  force3D?: boolean;
}

export const BrandedLoader = ({
  className,
  logoClassName,
  size = 132,
  label,
  force3D = false,
}: BrandedLoaderProps) => {
  const isInlineLoader = size <= 28 && !force3D;

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className={cn('shrink-0', logoClassName)}>
        {isInlineLoader ? (
          <SiteLogo
            size={size}
            className="animate-spin [animation-duration:0.8s] object-contain"
          />
        ) : (
          <Suspense
            fallback={
              <SiteLogo
                size={Math.max(40, Math.floor(size * 0.5))}
                className="animate-spin [animation-duration:0.8s] object-contain"
              />
            }
          >
            <LazyDNALoader size={size} />
          </Suspense>
        )}
      </div>
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
    </div>
  );
};
