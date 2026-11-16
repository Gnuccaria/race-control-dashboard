import { Switch } from '@/components/ui/Switch/Switch';
import { useI18n } from '@/i18n/useI18n';
import { useColorTheme } from '../../useColorTheme';
import { SunMoonIcon } from '../SunMoonIcon/SunMoonIcon';
import styles from './NightModeSetting.module.css';

/** Interruttore della modalità notte, con il ritorno all'impostazione del dispositivo. */
export function NightModeSetting() {
  const { isNightModeActive, isFollowingSystem, enableNightMode, followSystemColorScheme } = useColorTheme();
  const { messages } = useI18n();

  return (
    <div className={styles.nightModeSetting}>
      <Switch
        label={messages.theme.nightMode}
        description={isFollowingSystem ? messages.theme.followsDevice : messages.theme.setManually}
        isChecked={isNightModeActive}
        onCheckedChange={enableNightMode}
        thumbContent={<SunMoonIcon isMoon={isNightModeActive} />}
      />
      {!isFollowingSystem && (
        <button type="button" className={styles.followSystemButton} onClick={followSystemColorScheme}>
          {messages.theme.useDeviceSetting}
        </button>
      )}
    </div>
  );
}
