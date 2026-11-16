import type { Protest, ProtestReview } from '@shared/protestRules';
import { requestServerApi, requestServerBlob } from '@/services/serverApi';

/** Tutte le proteste mandate dal sito, dalla più recente. */
export const fetchProtests = () => requestServerApi({ method: 'GET', path: '/protests' }, (responseBody) => (responseBody as { protests: Protest[] }).protests);

export const fetchProtest = (protestId: number) =>
  requestServerApi({ method: 'GET', path: `/protests/${protestId}` }, (responseBody) => (responseBody as { protest: Protest }).protest);

/** Salva l'esito: respinta con la motivazione facoltativa, oppure di nuovo in esame. */
export const saveProtestReview = (protestId: number, review: ProtestReview) =>
  requestServerApi({ method: 'PUT', path: `/protests/${protestId}/review`, body: review }, (responseBody) => (responseBody as { protest: Protest }).protest);

/** Il video caricato con la protesta, da riprodurre nel player. */
export const fetchProtestVideo = (protestId: number) => requestServerBlob(`/protests/${protestId}/video`);
