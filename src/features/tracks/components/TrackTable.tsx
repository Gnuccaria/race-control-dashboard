import type { Track } from '@shared/raceRules';
import { TRACK_MAPS_CREDIT_URL, trackMapUrl } from '@shared/trackRules';
import { useState } from 'react';
import { type CatalogColumn, CatalogTable } from '@/components/data-table/CatalogTable';
import { MissingValue } from '@/components/data-table/MissingValue';
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

  const columns: readonly CatalogColumn<Track>[] = [
    { key: 'country', header: texts.columns.country, render: (track) => countryLabel(countryOf(track)) },
    { key: 'name', header: texts.columns.name, render: (track) => track.name },
    { key: 'configuration', header: texts.columns.configuration, render: (track) => configurationLabel(track.configuration) },
    { key: 'length', header: texts.columns.length, isNumber: true, render: (track) => (track.lengthMeters === null ? <MissingValue /> : lengthLabel(track.lengthMeters)) },
    { key: 'reversible', header: texts.columns.reversible, render: (track) => (track.hasReverseLayout === null ? <MissingValue /> : track.hasReverseLayout ? texts.yes : texts.no) },
    {
      key: 'map',
      header: texts.columns.map,
      render: (track) => {
        const mapUrl = track.mapFile ? trackMapUrl(track.mapFile) : null;
        return mapUrl ? (
          <a href={mapUrl} target="_blank" rel="noreferrer" aria-label={texts.mapOf(`${track.name} – ${configurationLabel(track.configuration)}`)}>
            {texts.openMap}
          </a>
        ) : (
          <MissingValue>{texts.noMap}</MissingValue>
        );
      },
    },
  ];

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
      <CatalogTable rows={shownTracks} totalCount={tracks.length} rowKey={(track) => track.id} columns={columns} texts={texts} />
      <p className={styles.credit}>
        {texts.mapCredit}{' '}
        <a href={TRACK_MAPS_CREDIT_URL} target="_blank" rel="noreferrer">
          gt-engine.com
        </a>
      </p>
    </div>
  );
}
