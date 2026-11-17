const CHAMPIONSHIP_ICON_PROPS = {
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

/** Coppa con un "+": crea un campionato. */
export function CreateChampionshipIcon() {
  return (
    <svg {...CHAMPIONSHIP_ICON_PROPS}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 4M17 6h2.5a2.5 2.5 0 0 1-2.6 4" />
      <path d="M12 13v3M9 20h4" />
      <path d="M18 15v6M15 18h6" />
    </svg>
  );
}

/** Coppa con un elenco: gestisce i campionati salvati. */
export function ManageChampionshipsIcon() {
  return (
    <svg {...CHAMPIONSHIP_ICON_PROPS}>
      <path d="M5 4h8v3a4 4 0 0 1-8 0V4Z" />
      <path d="M9 11v3M6.5 17h5" />
      <path d="M16 8h5M16 12h5M15 16h6M15 20h6" />
    </svg>
  );
}
