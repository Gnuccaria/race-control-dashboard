import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { setLanguagePreference } from '@/i18n/languagePreferenceStore';
import { TEST_CARS } from './testCars';
import { TEST_TRACKS } from './testTracks';

// Le pagine si caricano in lazy: con tutti i test in parallelo il primo caricamento può superare il secondo predefinito.
configure({ asyncUtilTimeout: 5000 });

// jsdom non implementa matchMedia: simuliamo un dispositivo in tema chiaro.
vi.stubGlobal('matchMedia', (mediaQuery: string) => ({
  matches: false,
  media: mediaQuery,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

// jsdom non implementa scrollIntoView (usato dagli elenchi a discesa per mostrare l'opzione scelta).
Element.prototype.scrollIntoView ??= () => undefined;

// jsdom non implementa showModal/close di <dialog>: basta gestire l'attributo open.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
  this.removeAttribute('open');
};

// jsdom 27 nasconde i [popover] chiusi ma non implementa showPopover né popovertarget: nei test
// la tendina in alto a destra resta sempre visibile, così se ne possono usare i comandi.
const popoverStyle = document.createElement('style');
popoverStyle.textContent = '[popover] { display: block; }';
document.head.append(popoverStyle);

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
