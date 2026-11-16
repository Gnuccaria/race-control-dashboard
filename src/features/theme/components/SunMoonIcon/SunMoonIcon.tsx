import { useId } from 'react';
import styles from './SunMoonIcon.module.css';

interface SunMoonIconProps {
  readonly isMoon: boolean;
}

const SUN_RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * Sole che diventa luna: i raggi ruotano e rientrano, il disco cresce e un'ombra
 * scorre dentro di esso fino a ritagliare la falce. Le transizioni sono in CSS.
 */
export function SunMoonIcon({ isMoon }: SunMoonIconProps) {
  const crescentMaskId = useId();

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.sunMoonIcon} data-moon={isMoon || undefined}>
      <mask id={crescentMaskId}>
        <rect width="24" height="24" fill="white" />
        <circle className={styles.crescentShadow} cx="24" cy="4" r="7" fill="black" />
      </mask>
      <circle className={styles.celestialDisc} cx="12" cy="12" r="5" fill="currentColor" mask={`url(#${crescentMaskId})`} />
      <g className={styles.sunRays} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {SUN_RAY_ANGLES.map((rayAngle) => (
          <line key={rayAngle} x1="12" y1="2.5" x2="12" y2="4.5" transform={`rotate(${rayAngle} 12 12)`} />
        ))}
      </g>
    </svg>
  );
}
