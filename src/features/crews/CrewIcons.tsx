const CREW_ICON_PROPS = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** Casco con un "+": aggiunge un equipaggio. */
export function AddCrewIcon() {
  return (
    <svg {...CREW_ICON_PROPS}>
      <path d="M4 15a8 8 0 0 1 15.5-2.8L20 15H4Z" />
      <path d="M4 15v2h9M12 11h7.5" />
      <path d="M18 17v5M15.5 19.5h5" />
    </svg>
  );
}

/** Elenco con caschi: gestisce gli equipaggi salvati. */
export function ManageCrewsIcon() {
  return (
    <svg {...CREW_ICON_PROPS}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.5" />
      <circle cx="4.5" cy="12" r="1.5" />
      <circle cx="4.5" cy="18" r="1.5" />
    </svg>
  );
}
