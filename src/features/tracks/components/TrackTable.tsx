import type { Track } from '@shared/raceRules';
import { TRACK_MAPS_CREDIT_URL, trackMapUrl } from '@shared/trackRules';
import { useState } from 'react';
import tableStyles from '@/components/data-table/DataTable.module.css';
import { EmptyState } from '@/components/data-table/ListStatus';
import { FormField } from '@/components/form/FormField/FormField';
import { Select } from '@/components/ui/Select/Select';
import { useI18n } from '@/i18n/useI18n';
import { countryOf, listConfigurations, listCountries, listTrackNames } from '../model/trackSelection';
import { useTrackLabels } from '../useTrackLabels';
import styles from '../ManageTracksPage.module.css';

/**
 * Tabella dei tracciati con i filtri a cascata Nazione → Tracciato → Configurazione: ogni filtro mostra solo le voci
 * compatibili con quelli precedenti, e cambiandolo si azzerano i successivi. Ordine: nazione, tracciato, configurazione.
 */
export function TrackTable({ tracks }: { readonly tracks: readonly Track[] }) {
  const { locale, messages } = useI18n();
  const texts = messages.manageTracks.manage;
  const { countryLabel, configurationLabel, lengthLabel } = useTrackLabels();
  const [country, setCountry] = useState('');
  const [trackName, setTrackName] = useState('');
  const [trackId, setTrackId] = useState('');

  const countries = listCountries(tracks, countryLabel);
  const trackNames = country === '' ? [] : listTrackNames(tracks, country);
  const configurations = country === '' || trackName === '' ? [] : listConfigurations(tracks, country, trackName);
  const order = (track: Track) => countries.indexOf(countryOf(track));
  const shownTracks = [...tracks]
    .filter(
      (track) =>
        (country === '' || countryOf(track) === country) &&
        (trackName === '' || track.name.toLowerCase() === trackName.toLowerCase()) &&
        (trackId === '' || String(track.id) === trackId),
    )
    .sort(
      (first, second) =>
        order(first) - order(second) || first.name.localeCompare(second.name, locale) || (first.configuration ?? '').localeCompare(second.configuration ?? '', locale),
    );

  return (
    <div className={styles.trackTable}>
      <div className={styles.filters} role="search">
        <FormField label={texts.countryFilter}>
          {(controlProps) => (
            <Select
              id={controlProps.id}
              value={country}
              options={[{ value: '', label: texts.allCountries }, ...countries.map((code) => ({ value: code, label: countryLabel(code) }))]}
              onValueChange={(value) => {
                setCountry(value);
                setTrackName('');
                setTrackId('');
              }}
            />
          )}
        </FormField>
        <FormField label={texts.trackFilter}>
          {(controlProps) => (
            <Select
              id={controlProps.id}
              disabled={country === ''}
              value={trackName}
              options={[{ value: '', label: texts.allTracks }, ...trackNames.map((name) => ({ value: name, label: name }))]}
              onValueChange={(value) => {
                setTrackName(value);
                setTrackId('');
              }}
            />
          )}
        </FormField>
        <FormField label={texts.configurationFilter}>
          {(controlProps) => (
            <Select
              id={controlProps.id}
              disabled={trackName === ''}
              value={trackId}
              options={[{ value: '', label: texts.allConfigurations }, ...configurations.map((track) => ({ value: String(track.id), label: configurationLabel(track.configuration) }))]}
              onValueChange={setTrackId}
            />
          )}
        </FormField>
      </div>
      <div className={tableStyles.tableCaption}>
        <p aria-live="polite">{texts.count(shownTracks.length, tracks.length)}</p>
      </div>
      {shownTracks.length === 0 ? (
        <EmptyState title={tracks.length === 0 ? texts.emptyTitle : texts.noMatches} description={tracks.length === 0 ? texts.emptyDescription : undefined} />
      ) : (
        <div className={tableStyles.tableScroller}>
          <table className={tableStyles.dataTable} aria-label={texts.tableLabel}>
            <thead>
              <tr>
                {(['country', 'name', 'configuration', 'length', 'reversible', 'map'] as const).map((column) => (
                  <th key={column} scope="col" className={tableStyles.plainColumnHeader}>
                    {texts.columns[column]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownTracks.map((track) => {
                const mapUrl = track.mapFile ? trackMapUrl(track.mapFile) : null;
                const name = `${track.name} – ${configurationLabel(track.configuration)}`;
                return (
                  <tr key={track.id} className={tableStyles.dataRow}>
                    <td>{countryLabel(countryOf(track))}</td>
                    <td>{track.name}</td>
                    <td>{configurationLabel(track.configuration)}</td>
                    <td className={tableStyles.numberCell}>{track.lengthMeters === null ? <span className={tableStyles.missingValue}>–</span> : lengthLabel(track.lengthMeters)}</td>
                    <td>{track.hasReverseLayout === null ? <span className={tableStyles.missingValue}>–</span> : track.hasReverseLayout ? texts.yes : texts.no}</td>
                    <td>
                      {mapUrl ? (
                        <a href={mapUrl} target="_blank" rel="noreferrer" aria-label={texts.mapOf(name)}>
                          {texts.openMap}
                        </a>
                      ) : (
                        <span className={tableStyles.missingValue}>{texts.noMap}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.credit}>
        {texts.mapCredit}{' '}
        <a href={TRACK_MAPS_CREDIT_URL} target="_blank" rel="noreferrer">
          gt-engine.com
        </a>
      </p>
    </div>
  );
}
