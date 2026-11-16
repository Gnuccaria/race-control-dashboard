import { FIE_DISCONNECTIONS_TOOL_INFO } from '@/features/fie-disconnections/toolInfo';

/** Calcolatore disconnessioni con un ticket già scelto (si compila da solo). */
export const disconnectionTicketHref = (ticketId: number) => `/strumenti/${FIE_DISCONNECTIONS_TOOL_INFO.slug}?ticket=${ticketId}`;
