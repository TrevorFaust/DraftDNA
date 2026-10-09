import { cn } from '@/lib/utils';

interface SiteLogoProps {
  className?: string;
  /** Width/height for consistent sizing (default 24 for icons, use 40 for navbar) */
  size?: number;
  /** Pass "" when a nearby heading already names the product. */
  alt?: string;
}

/** Site logo image. Use public/dna_image.png (PNG for transparent background). */
export const SiteLogo = ({ className, size = 24, alt = 'Draft DNA' }: SiteLogoProps) => (
  <img
    src="/dna_image.png"
    alt={alt}
    className={cn('object-contain', className)}
    width={size}
    height={size}
  />
);
