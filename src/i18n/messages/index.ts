import type { Locale } from '../locales';
import { de } from './de';
import { en } from './en';
import { fr } from './fr';
import { it, type Messages } from './it';

export type { Messages, ValidationMessageKey } from './it';

export const MESSAGES_BY_LOCALE: Record<Locale, Messages> = { it, en, fr, de };
