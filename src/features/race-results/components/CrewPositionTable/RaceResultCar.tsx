import { useI18n } from '@/i18n/useI18n';
import styles from './CrewPositionTable.module.css';

interface RaceResultCarProps {
  /** Auto attuale dell'equipaggio della riga; undefined = riga vuota. */
  readonly crewCarId: number | null | undefined;
  /** Auto che resta legata alla gara per questa riga. */
  readonly raceCarId: number | null | undefined;
  /** L'equipaggio dovrebbe portare la sua auto attuale ma non ne ha una: blocca il salvataggio. */
  readonly isMissing: boolean;
  readonly carNameById: ReadonlyMap<number, string>;
}

/** Vettura di una riga (ordine di arrivo, qualifiche); se diversa da quella attuale dell'equipaggio, lo dice al passaggio del mouse. */
export function RaceResultCar({ crewCarId, raceCarId, isMissing, carNameById }: RaceResultCarProps) {
  const { messages } = useI18n();
  const formTexts = messages.races.form;
  if (crewCarId === undefined || raceCarId === undefined) return <span className={styles.emptyCar}>–</span>;
  if (raceCarId === null) {
    return <span className={isMissing ? styles.missingCar : styles.emptyCar}>{formTexts.carMissing}</span>;
  }
  const carName = carNameById.get(raceCarId) ?? messages.cars.unknownCar;
  const currentCarName = crewCarId === null ? null : (carNameById.get(crewCarId) ?? null);
  const isHistoricCar = crewCarId !== raceCarId;
  return (
    <span
      className={isHistoricCar ? styles.historicCar : undefined}
      title={isHistoricCar ? formTexts.carUsedInRace(currentCarName ?? formTexts.carMissing.toLowerCase()) : undefined}
    >
      {carName}
    </span>
  );
}
