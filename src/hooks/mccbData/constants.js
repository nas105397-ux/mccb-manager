// useMccbData 系フックが共有する API エンドポイントとタイミング定数。
export const API_URL = "/api/mccb";
export const CORE_API_URL = `${API_URL}?core=1`;
export const VERSION_URL = `${API_URL}/version`;
export const LOGS_PAGE_URL = "/api/logs";
export const HISTORY_PAGE_URL = "/api/request-history";
export const BACKUPS_URL = "/api/admin/backups";
// 常時稼働端末の負荷を抑えつつ他端末の変更を追従する同期間隔。
export const POLL_INTERVAL = 5000;
export const LOG_PAGE_SIZE = 50;
export const HISTORY_PAGE_SIZE = 20;
// 手動操作の直後は自動巡回と衝突しないよう一時停止する時間。
export const MANUAL_ACTION_PAUSE_MS = 5000;
// 同期完了直後、次の自動巡回までの短い猶予。
export const SYNC_COMPLETE_PAUSE_MS = 1000;
