// キオスク端末の画面スリープ設定の取得・保存。
// 設定はキオスク側スクリプトが別途ポーリングするため、通常のcore同期には載せず単独で扱う。
import { useCallback, useState } from "react";
import {
  DEFAULT_KIOSK_SLEEP_SETTINGS,
  normalizeKioskSleepSettings,
} from "../../shared/kioskSleepSettings";
import { KIOSK_SLEEP_URL } from "./constants";

export function useKioskSleepSettings({ runSyncTask, applyVersion, applyLogs }) {
  const [kioskSleepSettings, setKioskSleepSettings] = useState(
    DEFAULT_KIOSK_SLEEP_SETTINGS,
  );

  const fetchKioskSleepSettings = useCallback(async () => {
    const res = await fetch(KIOSK_SLEEP_URL);
    if (!res.ok) {
      throw new Error(`キオスクスリープ設定の取得に失敗しました (${res.status})`);
    }
    const result = await res.json();
    const settings = normalizeKioskSleepSettings(result.kioskSleepSettings);
    setKioskSleepSettings(settings);
    return settings;
  }, []);

  const saveKioskSleepSettings = useCallback(
    (settings) => {
      runSyncTask(async () => {
        const res = await fetch(KIOSK_SLEEP_URL, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kioskSleepSettings: settings }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message =
            result?.error || `キオスクスリープ設定の保存に失敗しました (${res.status})`;
          alert(message);
          throw new Error(message);
        }

        setKioskSleepSettings(normalizeKioskSleepSettings(result.kioskSleepSettings));
        if (Array.isArray(result.logs)) {
          applyLogs(result.logs);
        }
        applyVersion(result.version);
        // 反映はキオスク端末側のポーリング周期(既定60秒)に依存するため、待ち時間を明示する。
        alert(
          "キオスクの画面スリープ設定を保存しました。\n表示端末には最大1分ほどで反映されます。",
        );
      });
    },
    [applyLogs, applyVersion, runSyncTask],
  );

  return {
    kioskSleepSettings,
    setKioskSleepSettings,
    fetchKioskSleepSettings,
    saveKioskSleepSettings,
  };
}
