import { formatBackupDate, formatBackupSize, UI_STYLES } from "./adminStyles";

// SQLite DB のバックアップ作成と、選択したバックアップからの復旧。
export default function DatabaseBackupPanel({
  databaseBackups,
  selectedBackupFileName,
  setSelectedBackupFile,
  onCreateDatabaseBackup,
  onRestoreDatabaseBackup,
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <h3 className={UI_STYLES.labelSubsection}>DBバックアップ・復旧</h3>
      <div className="space-y-4 text-xs font-bold">
        <div className="text-gray-500 font-medium">
          現在のSQLite DBを data/backups
          に保存します。最新10件を保持します。復旧前にも現在DBを自動バックアップします。
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCreateDatabaseBackup}
            className={UI_STYLES.btnCsvAction}
          >
            💾 DBバックアップ作成
          </button>
        </div>
        <div className="space-y-2 rounded-lg border border-red-100 bg-red-50/40 p-3">
          <label className="block text-[11px] font-black text-red-700">
            復旧するバックアップ
          </label>
          <select
            value={selectedBackupFileName}
            onChange={(e) => setSelectedBackupFile(e.target.value)}
            disabled={databaseBackups.length === 0}
            className={`${UI_STYLES.select} disabled:bg-gray-100 disabled:text-gray-400`}
          >
            {databaseBackups.length === 0 ? (
              <option value="">バックアップがありません</option>
            ) : (
              databaseBackups.map((backup) => (
                <option key={backup.fileName} value={backup.fileName}>
                  {backup.fileName} / {formatBackupDate(backup.createdAt)} /{" "}
                  {formatBackupSize(backup.size)}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            onClick={() => onRestoreDatabaseBackup(selectedBackupFileName)}
            disabled={!selectedBackupFileName}
            className={`${UI_STYLES.btnClearAction} ${UI_STYLES.btnDisabledBlocked}`}
          >
            ♻️ 選択バックアップからDB復旧
          </button>
        </div>
      </div>
    </div>
  );
}
