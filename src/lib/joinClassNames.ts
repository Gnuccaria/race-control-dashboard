/** Unisce classi CSS ignorando i valori falsy. */
export function joinClassNames(...classNames: (string | false | null | undefined)[]): string {
  return classNames.filter(Boolean).join(' ');
}
