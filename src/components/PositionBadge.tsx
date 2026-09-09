import { cn } from '@/lib/utils';

interface PositionBadgeProps {
  position: string;
  className?: string;
}

export const PositionBadge = ({ position, className }: PositionBadgeProps) => {
  const getPositionClass = (pos: string) => {
    switch (pos.toUpperCase()) {
      case 'QB':
        return 'position-qb';
      case 'RB':
        return 'position-rb';
      case 'WR':
        return 'position-wr';
      case 'TE':
        return 'position-te';
      case 'K':
        return 'position-k';
      case 'HC':
      case 'COACH':
        return 'bg-secondary text-secondary-foreground';
      case 'DEF':
      case 'D/ST':
      case 'DL':
      case 'EDGE':
      case 'LB':
      case 'DB':
      case 'CB':
      case 'S':
        return 'position-def';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <span className={cn('position-badge', getPositionClass(position), className)}>
      {position}
    </span>
  );
};
