import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { setLanguagePreference } from '@/i18n/languagePreferenceStore';
import { TEST_CARS } from './testCars';
import { TEST_TRACKS } from './testTracks';

// jsdom non implementa matchMedia: simuliamo un dispositivo in tema chiaro.
vi.stubGlobal('matchMedia', (mediaQuery: string) => ({
  matches: false,
  media: mediaQuery,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

// jsdom non implementa showModal/close di <dialog>: basta gestire l'attributo open.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
  this.removeAttribute('open');
};

// Le auto arrivano dal server: nei test l'elenco è sempre quello della migrazione.
vi.mock('@/features/cars/carApi', () => ({
  fetchCars: vi.fn(() => Promise.resolve({ isSuccess: true, value: TEST_CARS })),
}));

// Anche le piste: un piccolo elenco con continenti, configurazioni e senso inverso.
vi.mock('@/features/tracks/trackApi', () => ({
  fetchTracks: vi.fn(() => Promise.resolve({ isSuccess: true, value: TEST_TRACKS })),
}));

// I test verificano i testi italiani, indipendentemente dalla lingua di jsdom.
beforeEach(() => {
  setLanguagePreference('it');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
