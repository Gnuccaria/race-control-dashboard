import { describe, expect, it } from 'vitest';
import { checkProtestForm, chooseVideo, EMPTY_PROTEST_VALUES } from './protestFormValues';

const values = (overrides: Partial<typeof EMPTY_PROTEST_VALUES>) => ({ ...EMPTY_PROTEST_VALUES, championship: 'Cool1 FIE Championship', stint: '2', lap: '14', corner: 'Curva 3', ...overrides });
const file = (name: string, type: string, size: number) => {
  const chosen = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(chosen, 'size', { value: size });
  return chosen;
};

describe('modulo della protesta', () => {
  it('pronto con stint, giro e curva; il resto è facoltativo', () => {
    expect(checkProtestForm(values({})).submission).toEqual({ championship: 'Cool1 FIE Championship', stint: 2, lap: 14, corner: 'Curva 3', description: '', youtubeUrl: '', otherCrewIds: [] });
    expect(checkProtestForm(values({ championship: '' })).submission).toBeNull();
    expect(checkProtestForm(values({ corner: '  ' })).submission).toBeNull();
    expect(checkProtestForm(values({ stint: '' })).submission).toBeNull();
  });

  it('segnala stint, giro, link e curva non validi', () => {
    const check = checkProtestForm(values({ stint: '21', lap: '0', youtubeUrl: 'vimeo.com/1', corner: 'x'.repeat(41) }));
    expect(check).toMatchObject({ isStintInvalid: true, isLapInvalid: true, isYoutubeInvalid: true, isCornerInvalid: true, submission: null });
  });

  it('conta i caratteri rimasti della descrizione', () => {
    expect(checkProtestForm(values({ description: 'a'.repeat(460) })).remainingCharacters).toBe(40);
  });

  it('video: tipo riconosciuto anche dall’estensione, al massimo 100 MB', () => {
    expect(chooseVideo(file('giro.mov', '', 10)).type).toBe('video/quicktime');
    expect(chooseVideo(file('giro.mp4', 'video/mp4', 10)).type).toBe('video/mp4');
    expect(checkProtestForm(values({ video: chooseVideo(file('giro.avi', 'video/x-msvideo', 10)) })).videoIssue).toBe('invalid-type');
    expect(checkProtestForm(values({ video: chooseVideo(file('giro.mp4', 'video/mp4', 100_000_001)) }))).toMatchObject({ videoIssue: 'too-large', submission: null });
  });
});
