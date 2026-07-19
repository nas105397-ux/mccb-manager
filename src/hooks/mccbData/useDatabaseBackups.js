// DBバックアップの作成・復旧・一覧管理。
import { useCallback, useState } from "react";
import { BACKUPS_URL } from "./constants";

export function useDatabaseBackups({
  runSyncTask,
  applyVersion,
  applyLogs,
  applyServerData,
}) {
  const [databaseBackups, setDatabaseBackups] = useState([]);

  const fetchDatabaseBackups = useCallback(async () => {
    // バックアップ本体ではなく、管理画面表示用のメタデータだけを取得する。
    const res = await fetch(BACKUPS_URL);
    if (!res.ok) throw new Error(`DBバックアップ一覧の取得に失敗しました (${res.status})`);
    const result = await res.json();
    setDatabaseBackups(Array.isArray(result.backups) ? result.backups : []);
    return result.backups || [];
  }, []);

  const createDatabaseBackup = useCallback(() => {
    runSyncTask(async () => {
      const res = await fetch(BACKUPS_URL, { method: "POST" });
      if (!res.ok) throw new Error(`DBバックアップの作成に失敗しました (${res.status})`);

      const result = await res.json();
      if (Array.isArray(result.logs)) {
        applyLogs(result.logs);
      }
      applyVersion(result.version);
      await fetchDatabaseBackups();
      alert(`DBバックアップを作成しました。\n${result.backup?.fileName || ""}`);
    });
  }, [applyLogs, applyVersion, fetchDatabaseBackups, runSyncTask]);

  const restoreDatabaseBackup = useCallback(
    (fileName) => {
      if (!fileName) {
        alert("復旧するバックアップを選択してください。");
        return;
      }

      if (
        !window.confirm(
          `現在のDBをバックアップ「${fileName}」の内容で復旧します。\n復旧前の現在DBも自動バックアップします。\n実行してもよろしいですか？`,
        )
      ) {
        return;
      }

      runSyncTask(async () => {
        const res = await fetch(`${BACKUPS_URL}/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message =
            result?.error || `DBバックアップからの復旧に失敗しました (${res.status})`;
          alert(message);
          throw new Error(message);
        }

        if (result.data) {
          applyServerData(result.data);
        }
        setDatabaseBackups(Array.isArray(result.backups) ? result.backups : []);
        alert(
          `DBをバックアップから復旧しました。\n復旧元: ${result.restoredFrom || fileName}\n復旧前バックアップ: ${result.rollbackBackup?.fileName || ""}`,
        );
      });
    },
    [applyServerData, runSyncTask],
  );

  return {
    databaseBackups,
    setDatabaseBackups,
    fetchDatabaseBackups,
    createDatabaseBackup,
    restoreDatabaseBackup,
  };
}
