import { cn } from '@/lib/utils';

interface JerseyIconProps {
  jerseyNumber: number | null | undefined;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  tertiaryColor?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const JerseyIcon = ({
  jerseyNumber,
  primaryColor = '#8B1538', // Deep maroon/burgundy
  secondaryColor = '#FFD700', // Gold/yellow
  tertiaryColor = '#FFFFFF',
  size = 'md',
  className
}: JerseyIconProps) => {
  // Make jersey larger and more visible
  const sizeClasses = {
    sm: 'w-16 h-20',
    md: 'w-20 h-28',
    lg: 'w-28 h-36'
  };

  // Default colors if not provided - using maroon and gold as default (matching the image)
  const primary = primaryColor || '#8B1538'; // Maroon body
  const secondary = secondaryColor || '#FFD700'; // Gold collar, sleeves, and numbers
  const tertiary = tertiaryColor || '#FFFFFF';

  // Convert jersey number to string, handling null/undefined
  const jerseyNumStr = jerseyNumber !== null && jerseyNumber !== undefined 
    ? Math.floor(jerseyNumber).toString() 
    : null;

  return (
    <div className={cn('relative flex items-center justify-center', sizeClasses[size], className)}>
      <svg
        viewBox="0 0 140 180"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: 'drop-shadow(3px 5px 8px rgba(0,0,0,0.4))' }}
      >
        {/* Prominent drop shadow beneath and to the right */}
        <ellipse
          cx="75"
          cy="175"
          rx="45"
          ry="5"
          fill="#000000"
          opacity="0.35"
        />
        
        {/* Jersey body - maroon (primary color) with dark outline */}
        <path
          d="M 35 25 L 35 155 L 105 155 L 105 25 L 88 25 L 88 50 L 52 50 L 52 25 Z"
          fill={primary}
          stroke="#000000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        
        {/* Left sleeve - gold (secondary color) */}
        <path
          d="M 35 25 L 52 25 L 52 50 L 35 50 Z"
          fill={secondary}
          stroke="#000000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        
        {/* Right sleeve - gold (secondary color) */}
        <path
          d="M 88 25 L 105 25 L 105 50 L 88 50 Z"
          fill={secondary}
          stroke="#000000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        
        {/* Left sleeve cuff - maroon (primary color) */}
        <rect
          x="35"
          y="50"
          width="17"
          height="5"
          fill={primary}
          stroke="#000000"
          strokeWidth="2.5"
        />
        
        {/* Right sleeve cuff - maroon (primary color) */}
        <rect
          x="88"
          y="50"
          width="17"
          height="5"
          fill={primary}
          stroke="#000000"
          strokeWidth="2.5"
        />
        
        {/* V-neck collar - gold (secondary color) */}
        <path
          d="M 52 25 L 70 32 L 88 25 L 88 45 L 52 45 Z"
          fill={secondary}
          stroke="#000000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        
        {/* Main jersey number on front - gold with maroon outline (matching the image) */}
        {jerseyNumStr && (
          <>
            {/* Maroon outline for number */}
            <text
              x="70"
              y="110"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="58"
              fontWeight="900"
              fontFamily="Arial Black, Arial, sans-serif"
              fill={primary}
              stroke={primary}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="select-none"
              style={{ paintOrder: 'stroke fill' }}
            >
              {jerseyNumStr}
            </text>
            {/* Main number in gold (secondary color) */}
            <text
              x="70"
              y="110"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="58"
              fontWeight="900"
              fontFamily="Arial Black, Arial, sans-serif"
              fill={secondary}
              className="select-none"
            >
              {jerseyNumStr}
            </text>
          </>
        )}
        
        {/* Small number on right sleeve - gold with maroon outline (matching the image) */}
        {jerseyNumStr && (
          <>
            {/* Maroon outline for sleeve number */}
            <text
              x="96"
              y="38"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="14"
              fontWeight="900"
              fontFamily="Arial Black, Arial, sans-serif"
              fill={primary}
              stroke={primary}
              strokeWidth="1.5"
              strokeLinejoin="round"
              className="select-none"
              style={{ paintOrder: 'stroke fill' }}
            >
              {jerseyNumStr}
            </text>
            {/* Sleeve number in gold */}
            <text
              x="96"
              y="38"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="14"
              fontWeight="900"
              fontFamily="Arial Black, Arial, sans-serif"
              fill={secondary}
              className="select-none"
            >
              {jerseyNumStr}
            </text>
          </>
        )}
      </svg>
    </div>
  );
};
