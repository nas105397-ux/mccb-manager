import { useMemo, useState } from "react";
import {
  IDLE_MINUTES_OPTIONS,
  KIOSK_SLEEP_EXCEPTION_TYPES,
  KIOSK_SLEEP_EXCEPTION_TYPE_OPTIONS,
  KIOSK_SLEEP_MODES,
  KIOSK_SLEEP_MODE_OPTIONS,
  MAX_KIOSK_SLEEP_EXCEPTIONS,
  WAKE_GRACE_MINUTES_OPTIONS,
  addDaysToDateKey,
  describeKioskSleepPolicy,
  isValidDateKey,
  normalizeKioskSleepSettings,
  toDateKey,
} from "../../shared/kioskSleepSettings";
import { UI_STYLES } from "./adminStyles";

// 表示端末(キオスク)の画面スリープ設定。保存内容はキオスク側が定期取得して反映する。
const createExceptionId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `KSE-${crypto.randomUUID()}`;
  }
  return `KSE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
};

// 保存前後の差分判定では、サーバーが付与する更新時刻を無視する。
const toComparable = (settings) => {
  const normalized = normalizeKioskSleepSettings(settings);
  return JSON.stringify({ ...normalized, updatedAt: 0 });
};

const getExceptionStatus = (exception, today) => {
  if (exception.end < today) {
    return { label: "終了", className: "bg-gray-100 text-gray-500" };
  }
  if (exception.start > today) {
    return { label: "予定", className: "bg-blue-50 text-blue-700" };
  }
  return { label: "適用中", className: "bg-green-100 text-green-700" };
};

export default function KioskSleepSettingsPanel({
  kioskSleepSettings,
  onSaveKioskSleepSettings,
}) {
  // 編集中の値だけをローカルに持ち、未編集ならサーバー値をそのまま表示する。
  const [editedDraft, setEditedDraft] = useState(null);
  const savedSettings = useMemo(
    () => normalizeKioskSleepSettings(kioskSleepSettings),
    [kioskSleepSettings],
  );
  const draft = editedDraft ?? savedSettings;
  const today = toDateKey();
  const [newException, setNewException] = useState({
    type: KIOSK_SLEEP_EXCEPTION_TYPES.NO_SLEEP,
    start: today,
    end: today,
    label: "",
  });

  const isDirty = useMemo(
    () => toComparable(draft) !== toComparable(savedSettings),
    [draft, savedSettings],
  );
  const usesIdle =
    draft.mode === KIOSK_SLEEP_MODES.IDLE || draft.mode === KIOSK_SLEEP_MODES.BOTH;
  const usesSchedule =
    draft.mode === KIOSK_SLEEP_MODES.SCHEDULE || draft.mode === KIOSK_SLEEP_MODES.BOTH;
  const hasForceSleepException = draft.exceptions.some(
    (exception) => exception.type === KIOSK_SLEEP_EXCEPTION_TYPES.FORCE_SLEEP,
  );

  const setDraft = (updater) =>
    setEditedDraft((current) => updater(current ?? savedSettings));

  const updateDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const addException = (exception) => {
    if (!isValidDateKey(exception.start) || !isValidDateKey(exception.end)) {
      alert("開始日と終了日を入力してください。");
      return;
    }
    if (exception.end < exception.start) {
      alert("終了日は開始日以降にしてください。");
      return;
    }
    if (draft.exceptions.length >= MAX_KIOSK_SLEEP_EXCEPTIONS) {
      alert(`期間設定は最大 ${MAX_KIOSK_SLEEP_EXCEPTIONS} 件までです。`);
      return;
    }

    setDraft((current) => ({
      ...current,
      exceptions: [
        ...current.exceptions,
        { ...exception, id: createExceptionId() },
      ].sort((a, b) => a.start.localeCompare(b.start)),
    }));
  };

  const handleAddException = () => {
    addException(newException);
    setNewException({
      type: KIOSK_SLEEP_EXCEPTION_TYPES.NO_SLEEP,
      start: today,
      end: today,
      label: "",
    });
  };

  // 現場で最も多い「しばらく消さないでほしい」をワンタッチで登録する。
  const handleAddQuickNoSleep = (days, label) => {
    addException({
      type: KIOSK_SLEEP_EXCEPTION_TYPES.NO_SLEEP,
      start: today,
      end: addDaysToDateKey(today, days - 1),
      label,
    });
  };

  const handleDeleteException = (id) => {
    setDraft((current) => ({
      ...current,
      exceptions: current.exceptions.filter((exception) => exception.id !== id),
    }));
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <h3 className={UI_STYLES.labelSubsection}>表示端末 画面スリープ設定</h3>
      <div className="space-y-4 text-xs font-bold mt-2">
        <div className="text-gray-500 font-medium">
          現場の表示端末（キオスク）の消灯方法を設定します。保存後、端末には最大1分ほどで反映されます。
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700">
          <span className="text-gray-500 font-black mr-1.5">現在の動作:</span>
          {describeKioskSleepPolicy(kioskSleepSettings)}
        </div>

        <div className="space-y-2">
          <label className={UI_STYLES.label}>スリープ方式</label>
          <select
            value={draft.mode}
            onChange={(e) => updateDraft({ mode: e.target.value })}
            className={UI_STYLES.select}
          >
            {KIOSK_SLEEP_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="text-gray-500 font-medium">
            {
              KIOSK_SLEEP_MODE_OPTIONS.find((option) => option.value === draft.mode)
                ?.description
            }
          </div>
        </div>

        {usesIdle && (
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm w-fit">
            <span className="text-gray-500 font-black">無操作で消灯するまで:</span>
            <select
              value={draft.idleMinutes}
              onChange={(e) => updateDraft({ idleMinutes: Number(e.target.value) })}
              className={UI_STYLES.selectMaxSize}
            >
              {IDLE_MINUTES_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} 分
                </option>
              ))}
            </select>
          </div>
        )}

        {usesSchedule && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gray-500 font-black">消灯する時間帯:</span>
            <input
              type="time"
              value={draft.sleepStart}
              onChange={(e) => updateDraft({ sleepStart: e.target.value })}
              className="border p-1.5 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-gray-500">〜</span>
            <input
              type="time"
              value={draft.sleepEnd}
              onChange={(e) => updateDraft({ sleepEnd: e.target.value })}
              className="border p-1.5 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-gray-500 font-medium">（日をまたぐ指定も可）</span>
          </div>
        )}

        {(usesSchedule || hasForceSleepException) && (
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm w-fit">
            <span className="text-gray-500 font-black">画面に触れた後の点灯維持:</span>
            <select
              value={draft.wakeGraceMinutes}
              onChange={(e) =>
                updateDraft({ wakeGraceMinutes: Number(e.target.value) })
              }
              className={UI_STYLES.selectMaxSize}
            >
              {WAKE_GRACE_MINUTES_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes === 0 ? "すぐ再消灯" : `${minutes} 分`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="border-t border-gray-150 pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 font-black">期間設定（カレンダー）</span>
            <span className="text-gray-400 font-medium">
              {draft.exceptions.length} / {MAX_KIOSK_SLEEP_EXCEPTIONS} 件
            </span>
          </div>
          <div className="text-gray-500 font-medium">
            期間中はスリープ方式より優先されます。工事期間の常時点灯や、長期休業中の終日消灯に使います。
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleAddQuickNoSleep(7, "1週間スリープ停止")}
              className={UI_STYLES.btnSecondary}
            >
              ＋ 今日から1週間スリープしない
            </button>
            <button
              onClick={() => handleAddQuickNoSleep(3, "3日間スリープ停止")}
              className={UI_STYLES.btnSecondary}
            >
              ＋ 今日から3日間スリープしない
            </button>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={newException.type}
                onChange={(e) =>
                  setNewException((current) => ({ ...current, type: e.target.value }))
                }
                className="border p-1.5 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {KIOSK_SLEEP_EXCEPTION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={newException.start}
                onChange={(e) =>
                  setNewException((current) => ({
                    ...current,
                    start: e.target.value,
                    end: current.end < e.target.value ? e.target.value : current.end,
                  }))
                }
                className="border p-1.5 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-gray-500">〜</span>
              <input
                type="date"
                value={newException.end}
                min={newException.start}
                onChange={(e) =>
                  setNewException((current) => ({ ...current, end: e.target.value }))
                }
                className="border p-1.5 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <input
                type="text"
                value={newException.label}
                maxLength={40}
                placeholder="名称（例: 定期点検）"
                onChange={(e) =>
                  setNewException((current) => ({ ...current, label: e.target.value }))
                }
                className={UI_STYLES.inputSmall}
              />
              <button onClick={handleAddException} className={UI_STYLES.btnSecondary}>
                期間を追加
              </button>
            </div>
          </div>

          {draft.exceptions.length === 0 ? (
            <div className="text-gray-400 font-medium">期間設定はありません。</div>
          ) : (
            <div className={UI_STYLES.listContainer}>
              {draft.exceptions.map((exception) => {
                const status = getExceptionStatus(exception, today);
                return (
                  <div key={exception.id} className={UI_STYLES.listItem}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded font-black ${status.className}`}
                      >
                        {status.label}
                      </span>
                      <span className={UI_STYLES.listItemText}>
                        {exception.type === KIOSK_SLEEP_EXCEPTION_TYPES.NO_SLEEP
                          ? "スリープしない"
                          : "終日スリープ"}
                      </span>
                      <span className="text-gray-600 font-medium">
                        {exception.start} 〜 {exception.end}
                      </span>
                      {exception.label && (
                        <span className="text-gray-400 font-medium">
                          / {exception.label}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteException(exception.id)}
                      className={UI_STYLES.btnDangerSmall}
                    >
                      削除
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-150 pt-3">
          <button
            onClick={() => onSaveKioskSleepSettings(draft)}
            disabled={!isDirty}
            className={`${UI_STYLES.btnPrimary} ${UI_STYLES.btnDisabledBlocked}`}
          >
            💾 スリープ設定を保存
          </button>
          <button
            onClick={() => setEditedDraft(null)}
            disabled={!isDirty}
            className={`${UI_STYLES.btnSecondary} ${UI_STYLES.btnDisabledBlocked}`}
          >
            変更を破棄
          </button>
          {isDirty && (
            <span className="text-amber-600 font-black">未保存の変更があります</span>
          )}
        </div>
      </div>
    </div>
  );
}
