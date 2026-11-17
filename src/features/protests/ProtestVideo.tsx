import { youtubeEmbedUrl, youtubeWatchUrl } from '@shared/protestRules';
import { useEffect, useState } from 'react';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Button } from '@/components/ui/Button/Button';
import type { ServerErrorKind } from '@/services/serverApi';
import { useI18n } from '@/i18n/useI18n';
import styles from './Protests.module.css';
import { fetchProtestVideo } from './services/protestApi';

type LoadedVideo = { readonly status: 'ready'; readonly url: string } | { readonly status: 'failed'; readonly errorKind: ServerErrorKind };
type VideoState = { readonly status: 'loading' } | LoadedVideo;

/** Video caricato dal sito: l'app lo scarica (con il token) e lo riproduce nel player; la memoria si libera all'uscita. */
export function UploadedProtestVideo({ protestId, size }: { readonly protestId: number; readonly size: number }) {
  const { messages, locale } = useI18n();
  const texts = messages.protests.detail;
  const [attempt, setAttempt] = useState(0);
  // Ogni risultato ricorda a quale richiesta (protesta e tentativo) appartiene: finché non arriva quello
  // della richiesta corrente il video risulta in caricamento, senza azzerare lo stato dentro l'effetto.
  const requestKey = `${protestId}:${attempt}`;
  const [loadedVideo, setLoadedVideo] = useState<{ readonly requestKey: string; readonly video: LoadedVideo } | null>(null);
  const videoState: VideoState = loadedVideo?.requestKey === requestKey ? loadedVideo.video : { status: 'loading' };

  useEffect(() => {
    let objectUrl: string | null = null;
    let isCurrent = true;
    void fetchProtestVideo(protestId).then((result) => {
      if (!isCurrent) return;
      if (!result.isSuccess) {
        setLoadedVideo({ requestKey, video: { status: 'failed', errorKind: result.errorKind } });
        return;
      }
      objectUrl = URL.createObjectURL(result.value);
      setLoadedVideo({ requestKey, video: { status: 'ready', url: objectUrl } });
    });
    return () => {
      isCurrent = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [protestId, requestKey]);

  if (videoState.status === 'loading') {
    return (
      <p className={styles.videoStatus} role="status">
        {texts.videoLoading((size / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 }))}
      </p>
    );
  }
  if (videoState.status === 'failed') {
    return (
      <div className={styles.videoStatus}>
        <InlineAlert>{messages.serverErrors[videoState.errorKind]}</InlineAlert>
        <Button variant="secondary" onClick={() => setAttempt((previous) => previous + 1)}>
          {messages.crews.list.retry}
        </Button>
      </div>
    );
  }
  return (
    // Video di gara caricato dai piloti: non ha sottotitoli.
    <video className={styles.videoPlayer} src={videoState.url} controls preload="metadata" aria-label={texts.uploadedVideo} />
  );
}

/** Video YouTube nel player "privacy avanzata", con il link per aprirlo nel browser. */
export function YoutubeProtestVideo({ videoId }: { readonly videoId: string }) {
  const { messages } = useI18n();
  const texts = messages.protests.detail;
  return (
    <div className={styles.youtubeVideo}>
      <iframe
        className={styles.videoPlayer}
        src={youtubeEmbedUrl(videoId)}
        title={texts.youtubeVideo}
        allow="encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
      <a className={styles.externalLink} href={youtubeWatchUrl(videoId)} target="_blank" rel="noreferrer">
        {texts.openOnYoutube}
      </a>
    </div>
  );
}
