import type { ProtestStatus } from '@shared/protestRules';
import type { StatusTone } from '@/components/ui/StatusBadge/StatusBadge';

/** Colore dello stato di una protesta: in esame (ambra), accolta (verde), respinta (rosso). App e sito. */
export const protestStatusTone = (status: ProtestStatus): StatusTone =>
  status === 'rejected' ? 'critical' : status === 'accepted' ? 'positive' : 'warning';
