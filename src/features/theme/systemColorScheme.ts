const DARK_COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

const getDarkColorSchemeMediaQuery = () => window.matchMedia(DARK_COLOR_SCHEME_QUERY);

export const getSystemPrefersDarkColorScheme = (): boolean => getDarkColorSchemeMediaQuery().matches;

export function subscribeToSystemColorScheme(listener: () => void) {
  const darkColorSchemeMediaQuery = getDarkColorSchemeMediaQuery();
  darkColorSchemeMediaQuery.addEventListener('change', listener);
  return () => {
    darkColorSchemeMediaQuery.removeEventListener('change', listener);
  };
}
