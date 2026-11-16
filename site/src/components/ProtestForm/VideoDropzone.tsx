import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { useI18n } from '@/i18n/useI18n';
import { type ChosenVideo, chooseVideo, formatMegabytes } from './protestFormValues';
import styles from './ProtestForm.module.css';

interface VideoDropzoneProps {
  readonly video: ChosenVideo | null;
  readonly onChange: (video: ChosenVideo | null) => void;
  readonly errorMessage?: string | undefined;
  readonly disabled?: boolean;
}

/**
 * Zona per il video: si clicca per scegliere il file oppure lo si trascina dentro. Il campo file vero resta nella
 * pagina (nascosto alla vista ma raggiungibile con la tastiera), la zona è la sua etichetta.
 */
export function VideoDropzone({ video, onChange, errorMessage, disabled = false }: VideoDropzoneProps) {
  const { messages, locale } = useI18n();
  const texts = messages.site.protest.form;
  const inputId = useId();
  const messageId = `${inputId}-message`;
  const [isDragging, setIsDragging] = useState(false);

  if (video) {
    return (
      <div className={styles.videoField}>
        <div className={styles.chosenVideo} data-invalid={errorMessage ? true : undefined}>
          <span className={styles.chosenVideoName}>{video.file.name}</span>
          <span className={styles.chosenVideoSize}>{formatMegabytes(video.file.size, locale)}</span>
          <Button variant="secondary" disabled={disabled} onClick={() => onChange(null)}>
            {texts.removeVideo}
          </Button>
        </div>
        {errorMessage && (
          <p id={messageId} className={styles.fieldError} role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.videoField}>
      <label
        htmlFor={inputId}
        className={styles.dropzone}
        data-dragging={isDragging || undefined}
        onDragOver={(dragEvent) => {
          dragEvent.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(dropEvent) => {
          dropEvent.preventDefault();
          setIsDragging(false);
          const file = dropEvent.dataTransfer.files[0];
          if (file && !disabled) onChange(chooseVideo(file));
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="13" height="14" rx="2" />
          <path d="m16 10 5-3v10l-5-3" />
        </svg>
        <span className={styles.dropzoneTitle}>{texts.videoDrop}</span>
        <span className={styles.dropzoneHint}>{texts.videoHint}</span>
      </label>
      <input
        id={inputId}
        type="file"
        className={styles.fileInput}
        accept="video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov"
        disabled={disabled}
        aria-label={texts.video}
        onChange={(changeEvent) => {
          const file = changeEvent.currentTarget.files?.[0];
          if (file) onChange(chooseVideo(file));
          changeEvent.currentTarget.value = '';
        }}
      />
    </div>
  );
}
