// キオスク端末(Raspberry Pi)の画面スリープ設定。
// サーバーは設定を保存して「今日の実効ポリシー」を配信し、kiosk 側スクリプトがそれに従って xset を実行する。
// 判定ロジックをこのファイルに集約し、サーバー・管理画面の双方から同じ結果を得る。

export const KIOSK_SLEEP_MODES = {
  OFF: "off",
  IDLE: "idle",
  SCHEDULE: "schedule",
  BOTH: "both",
  ALWAYS: "always",
};

// 管理画面で選べる基本モード。always は「休業期間」例外の実効値専用で、直接は選ばせない。
export const KIOSK_SLEEP_MODE_OPTIONS = [
  {
    value: KIOSK_SLEEP_MODES.OFF,
    label: "スリープしない",
    description: "画面を常時点灯します。",
  },
  {
    value: KIOSK_SLEEP_MODES.IDLE,
    label: "無操作時のみ",
    description: "一定時間操作がなければ消灯し、画面に触れると復帰します。",
  },
  {
    value: KIOSK_SLEEP_MODES.SCHEDULE,
    label: "時間帯のみ",
    description: "指定した時間帯だけ消灯します。時間外は常時点灯します。",
  },
  {
    value: KIOSK_SLEEP_MODES.BOTH,
    label: "無操作＋時間帯",
    description: "無操作消灯と時間帯消灯の両方を有効にします。",
  },
];

export const KIOSK_SLEEP_EXCEPTION_TYPES = {
  NO_SLEEP: "no-sleep",
  FORCE_SLEEP: "force-sleep",
};

export const KIOSK_SLEEP_EXCEPTION_TYPE_OPTIONS = [
  {
    value: KIOSK_SLEEP_EXCEPTION_TYPES.NO_SLEEP,
    label: "スリープしない期間",
    description: "工事期間中などに画面を常時点灯させます。",
  },
  {
    value: KIOSK_SLEEP_EXCEPTION_TYPES.FORCE_SLEEP,
    label: "終日スリープ期間",
    description: "長期休業中などに画面を終日消灯させます。",
  },
];

export const IDLE_MINUTES_OPTIONS = [5, 10, 15, 30, 60, 120];
export const WAKE_GRACE_MINUTES_OPTIONS = [0, 1, 3, 5, 10, 15, 30];

// 期間指定の例外は上限を設け、設定肥大と配信ペイロードの増加を防ぐ。
export const MAX_KIOSK_SLEEP_EXCEPTIONS = 50;
// 終了済み例外は履歴として少し残し、古くなったものだけ保存時に整理する。
export const EXPIRED_EXCEPTION_RETENTION_DAYS = 90;

export const DEFAULT_KIOSK_SLEEP_SETTINGS = {
  mode: KIOSK_SLEEP_MODES.BOTH,
  idleMinutes: 30,
  sleepStart: "20:00",
  sleepEnd: "06:00",
  // 消灯時間帯に画面へ触れたとき、再消灯までこの分数だけ点灯を維持する。
  wakeGraceMinutes: 5,
  exceptions: [],
  updatedAt: 0,
};

const MODE_VALUES = new Set(Object.values(KIOSK_SLEEP_MODES));
const EXCEPTION_TYPE_VALUES = new Set(Object.values(KIOSK_SLEEP_EXCEPTION_TYPES));
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const pad2 = (value) => String(value).padStart(2, "0");

/** Date を "YYYY-MM-DD"（端末ローカル日付）へ変換する。文字列比較で期間判定できる形式。 */
export const toDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** "YYYY-MM-DD" に日数を加算した日付キーを返す。 */
export const addDaysToDateKey = (dateKey, days) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return toDateKey(date);
};

export const isValidDateKey = (value) =>
  typeof value === "string" && DATE_PATTERN.test(value);

const normalizeTime = (value, fallback) =>
  typeof value === "string" && TIME_PATTERN.test(value) ? value : fallback;

const normalizeMinutes = (value, fallback, { min = 0, max = 720 } = {}) => {
  const minutes = Math.round(Number(value));
  if (!Number.isFinite(minutes) || minutes < min || minutes > max) return fallback;
  return minutes;
};

const normalizeException = (exception, index) => {
  if (!exception || typeof exception !== "object") return null;

  const type = EXCEPTION_TYPE_VALUES.has(exception.type)
    ? exception.type
    : KIOSK_SLEEP_EXCEPTION_TYPES.NO_SLEEP;

  if (!isValidDateKey(exception.start) || !isValidDateKey(exception.end)) return null;

  // 開始と終了が逆転した入力も、期間として成立する向きへ揃えて受け入れる。
  const [start, end] =
    exception.start <= exception.end
      ? [exception.start, exception.end]
      : [exception.end, exception.start];

  return {
    id: String(exception.id || `KSE-${start}-${index}`),
    type,
    start,
    end,
    label: String(exception.label || "").slice(0, 40),
  };
};

export const normalizeKioskSleepSettings = (settings) => {
  const source = settings && typeof settings === "object" ? settings : {};
  const defaults = DEFAULT_KIOSK_SLEEP_SETTINGS;

  const exceptions = (Array.isArray(source.exceptions) ? source.exceptions : [])
    .map(normalizeException)
    .filter(Boolean)
    .sort((a, b) => (a.start === b.start ? a.end.localeCompare(b.end) : a.start.localeCompare(b.start)))
    .slice(0, MAX_KIOSK_SLEEP_EXCEPTIONS);

  return {
    mode: MODE_VALUES.has(source.mode) ? source.mode : defaults.mode,
    idleMinutes: normalizeMinutes(source.idleMinutes, defaults.idleMinutes, { min: 1 }),
    sleepStart: normalizeTime(source.sleepStart, defaults.sleepStart),
    sleepEnd: normalizeTime(source.sleepEnd, defaults.sleepEnd),
    wakeGraceMinutes: normalizeMinutes(source.wakeGraceMinutes, defaults.wakeGraceMinutes, {
      max: 180,
    }),
    exceptions,
    updatedAt: Number(source.updatedAt) || 0,
  };
};

/** 保存時に、終了から十分経過した例外だけを取り除く。 */
export const pruneExpiredExceptions = (exceptions, now = new Date()) => {
  const limit = addDaysToDateKey(toDateKey(now), -EXPIRED_EXCEPTION_RETENTION_DAYS);
  return exceptions.filter((exception) => exception.end >= limit);
};

/** 指定日に適用される例外期間を返す（重複時は先に始まったものを優先）。 */
export const findActiveException = (settings, now = new Date()) => {
  const today = toDateKey(now);
  const normalized = normalizeKioskSleepSettings(settings);
  return (
    normalized.exceptions.find(
      (exception) => exception.start <= today && today <= exception.end,
    ) || null
  );
};

/**
 * 例外期間を反映した「その時点で kiosk が従うべきポリシー」を組み立てる。
 * kiosk 側スクリプトが日付判定を持たずに済むよう、モードまで解決して返す。
 */
export const resolveKioskSleepPolicy = (settings, now = new Date()) => {
  const normalized = normalizeKioskSleepSettings(settings);
  const activeException = findActiveException(normalized, now);

  let mode = normalized.mode;
  if (activeException?.type === KIOSK_SLEEP_EXCEPTION_TYPES.NO_SLEEP) {
    mode = KIOSK_SLEEP_MODES.OFF;
  } else if (activeException?.type === KIOSK_SLEEP_EXCEPTION_TYPES.FORCE_SLEEP) {
    mode = KIOSK_SLEEP_MODES.ALWAYS;
  }

  return { ...normalized, mode, activeException };
};

/** kiosk のシェルスクリプトが読む key=value 形式へ変換する（ASCII のみ）。 */
export const formatKioskSleepPolicyText = (policy) => {
  const lines = [
    `mode=${policy.mode}`,
    `idle_minutes=${policy.idleMinutes}`,
    `sleep_start=${policy.sleepStart}`,
    `sleep_end=${policy.sleepEnd}`,
    `wake_grace_minutes=${policy.wakeGraceMinutes}`,
  ];

  if (policy.activeException) {
    lines.push(`exception_type=${policy.activeException.type}`);
    lines.push(`exception_end=${policy.activeException.end}`);
  }

  return `${lines.join("\n")}\n`;
};

/** 管理画面向けに、現在の実効状態を日本語1行で説明する。 */
export const describeKioskSleepPolicy = (settings, now = new Date()) => {
  const policy = resolveKioskSleepPolicy(settings, now);
  const exceptionNote = policy.activeException
    ? `例外期間「${policy.activeException.label || "名称なし"}」(〜${policy.activeException.end}) 適用中: `
    : "";

  switch (policy.mode) {
    case KIOSK_SLEEP_MODES.OFF:
      return `${exceptionNote}常時点灯`;
    case KIOSK_SLEEP_MODES.IDLE:
      return `${exceptionNote}${policy.idleMinutes}分間無操作で消灯`;
    case KIOSK_SLEEP_MODES.SCHEDULE:
      return `${exceptionNote}${policy.sleepStart}〜${policy.sleepEnd}は消灯`;
    case KIOSK_SLEEP_MODES.BOTH:
      return `${exceptionNote}${policy.idleMinutes}分間無操作で消灯 / ${policy.sleepStart}〜${policy.sleepEnd}は消灯`;
    case KIOSK_SLEEP_MODES.ALWAYS:
      return `${exceptionNote}終日消灯`;
    default:
      return exceptionNote || "設定なし";
  }
};
