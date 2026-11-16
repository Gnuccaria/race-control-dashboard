import { protestVideoDeadline, type SiteProtest, youtubeEmbedUrl, youtubeVideoIdFrom } from '@shared/protestRules';
import { useEffect, useState } from 'react';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { FormField } from '@/components/form/FormField/FormField';
import { Button } from '@/components/ui/Button/Button';
import { Input } from '@/components/ui/Input/Input';
import { Panel } from '@/components/ui/Panel/Panel';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar';
import { useI18n } from '@/i18n/useI18n';
import { addProtestYoutube, fetchProtestVideoBlob, type ProtestRequestProblem, uploadProtestVideo, type VideoUploadProblem } from '../../api/protests';
import { endExpiredSiteSession, getFreshSiteAccessToken } from '../../auth/siteAuthStore';
import { type ChosenVideo, checkProtestForm, EMPTY_PROTEST_VALUES } from '../ProtestForm/protestFormValues';
import formStyles from '../ProtestForm/ProtestForm.module.css';
import { VideoDropzone } from '../ProtestForm/VideoDropzone';
import styles from './ProtestVideoSection.module.css';

type PlayerState = { readonly status: 'loading' } | { readonly status: 'ready'; readonly url: string } | { readonly status: 'expired' } | { readonly status: 'failed' };

/** Video caricato: lo si scarica con il token e lo si riproduce dalla memoria (liberata all'uscita). */
function UploadedVideoPlayer({ protestId }: { readonly protestId: number }) {
  const { messages } = useI18n();
  const texts = messages.site.protestDetail;
  const [playerState, setPlayerState] = useState<PlayerState>({ status: 'loading' });

  useEffect(() => {
    let objectUrl: string | null = null;
    let isCurrent = true;
    void (async () => {
      const accessToken = await getFreshSiteAccessToken();
      const video = accessToken ? await fetchProtestVideoBlob(accessToken, protestId) : null;
      if (!isCurrent) return;
      if (video === 'expired') setPlayerState({ status: 'expired' });
      else if (video === null) setPlayerState({ status: 'failed' });
      else {
        objectUrl = URL.createObjectURL(video);
        setPlayerState({ status: 'ready', url: objectUrl });
      }
    })();
    return () => {
      isCurrent = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [protestId]);

  if (playerState.status === 'ready') return <video className={styles.videoPlayer} src={playerState.url} controls preload="metadata" aria-label={texts.uploadedVideo} />;
  return (
    <p className={styles.videoStatus} role="status">
      {playerState.status === 'loading' ? texts.videoLoading : playerState.status === 'expired' ? texts.videoExpired : texts.videoUnavailable}
    </p>
  );
}

interface ProtestVideoSectionProps {
  readonly protest: SiteProtest;
  /** Problema del video caricato con l'invio (arriva dalla pagina del modulo). */
  readonly initialVideoProblem: VideoUploadProblem | null;
  /** Dopo un'aggiunta riuscita: la pagina rilegge la protesta. */
  readonly onChanged: () => void;
}

/**
 * Video della protesta: quelli già inviati (caricato e YouTube) e, entro 24 ore dall'invio e solo per chi l'ha
 * mandata, la possibilità di aggiungere quello che manca. Poi l'aggiunta si chiude.
 */
export function ProtestVideoSection({ protest, initialVideoProblem, onChanged }: ProtestVideoSectionProps) {
  const { messages, locale } = useI18n();
  const texts = messages.site.protestDetail;
  const formTexts = messages.site.protest.form;
  const [video, setVideo] = useState<ChosenVideo | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploadFraction, setUploadFraction] = useState<number | null>(null);
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [videoProblem, setVideoProblem] = useState<VideoUploadProblem | null>(initialVideoProblem);
  const [linkProblem, setLinkProblem] = useState<ProtestRequestProblem | null>(null);
  const videoIssue = checkProtestForm({ ...EMPTY_PROTEST_VALUES, video }).videoIssue;
  const isYoutubeInvalid = youtubeUrl.trim() !== '' && youtubeVideoIdFrom(youtubeUrl) === null;
  const canAdd = protest.canAddVideo || protest.canAddYoutube;
  const deadline = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(protestVideoDeadline(protest.createdAt));

  const upload = async () => {
    if (!video || videoIssue) return;
    setVideoProblem(null);
    const accessToken = await getFreshSiteAccessToken();
    if (!accessToken) {
      endExpiredSiteSession();
      return;
    }
    setUploadFraction(0);
    const result = await uploadProtestVideo(accessToken, protest.id, video.file, setUploadFraction);
    setUploadFraction(null);
    if (result.isSuccess) {
      setVideo(null);
      onChanged();
    } else setVideoProblem(result.problem === 'signed-out' ? 'unavailable' : result.problem);
  };

  const saveLink = async () => {
    if (youtubeUrl.trim() === '' || isYoutubeInvalid) return;
    setLinkProblem(null);
    setIsSavingLink(true);
    const accessToken = await getFreshSiteAccessToken();
    const result = accessToken ? await addProtestYoutube(accessToken, protest.id, youtubeUrl) : null;
    setIsSavingLink(false);
    if (result?.isSuccess) {
      setYoutubeUrl('');
      onChanged();
      return;
    }
    const problem = result ? result.problem : 'signed-out';
    if (problem === 'signed-out') endExpiredSiteSession();
    setLinkProblem(problem);
  };

  return (
    <Panel title={texts.videoTitle} description={canAdd ? texts.addUntil(deadline) : texts.addClosed}>
      <div className={styles.videoSection}>
        {!protest.video && !protest.youtubeVideoId && !canAdd && <p className={styles.missingText}>{texts.noVideo}</p>}
        {(protest.video || protest.youtubeVideoId) && (
          <div className={styles.videos}>
            {protest.video && (
              <section className={styles.videoBlock} aria-label={texts.uploadedVideo}>
                <h3 className={styles.videoHeading}>{texts.uploadedVideo}</h3>
                {protest.video.isExpired ? <p className={styles.videoStatus}>{texts.videoExpired}</p> : <UploadedVideoPlayer protestId={protest.id} />}
              </section>
            )}
            {protest.youtubeVideoId && (
              <section className={styles.videoBlock} aria-label={texts.youtubeVideo}>
                <h3 className={styles.videoHeading}>{texts.youtubeVideo}</h3>
                <iframe
                  className={styles.videoPlayer}
                  src={youtubeEmbedUrl(protest.youtubeVideoId)}
                  title={texts.youtubeVideo}
                  allow="encrypted-media; picture-in-picture; fullscreen"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </section>
            )}
          </div>
        )}

        {videoProblem && <InlineAlert>{texts.videoNotUploaded(formTexts.videoProblems[videoProblem])}</InlineAlert>}

        {protest.canAddVideo && (
          <div className={styles.addBlock}>
            <p className={formStyles.groupLabel}>{texts.addVideo}</p>
            <VideoDropzone
              video={video}
              disabled={uploadFraction !== null}
              errorMessage={videoIssue ? formTexts.videoIssues[videoIssue] : undefined}
              onChange={setVideo}
            />
            {uploadFraction !== null && (
              <div className={formStyles.uploadProgress} role="status">
                <span>{formTexts.uploading(Math.round(uploadFraction * 100))}</span>
                <ProgressBar value={uploadFraction * 100} maximum={100} accessibleLabel={texts.addVideo} />
              </div>
            )}
            {video && (
              <div className={styles.addActions}>
                <Button variant="confirm" disabled={videoIssue !== null || uploadFraction !== null} onClick={() => void upload()}>
                  {texts.uploadVideo}
                </Button>
              </div>
            )}
          </div>
        )}

        {protest.canAddYoutube && (
          <div className={styles.addBlock}>
            <FormField label={formTexts.youtube} hint={formTexts.youtubeHint} errorMessage={isYoutubeInvalid ? formTexts.youtubeInvalid : undefined}>
              {({ isInvalid, ...inputAttributes }) => (
                <Input
                  {...inputAttributes}
                  type="text"
                  inputMode="url"
                  placeholder="https://youtu.be/…"
                  spellCheck={false}
                  isInvalid={isInvalid}
                  value={youtubeUrl}
                  onValueChange={setYoutubeUrl}
                />
              )}
            </FormField>
            {linkProblem && <InlineAlert>{formTexts.errors[linkProblem]}</InlineAlert>}
            <div className={styles.addActions}>
              <Button variant="confirm" disabled={youtubeUrl.trim() === '' || isYoutubeInvalid || isSavingLink} onClick={() => void saveLink()}>
                {texts.saveLink}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
