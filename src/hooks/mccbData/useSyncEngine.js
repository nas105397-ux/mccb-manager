// 手動操作とポーリング巡回の衝突を避ける、サーバー書き込み用の直列実行キュー。
import { useCallback, useRef } from "react";
import { MANUAL_ACTION_PAUSE_MS, SYNC_COMPLETE_PAUSE_MS } from "./constants";

export function useSyncEngine() {
  const syncQueue = useRef(Promise.resolve());
  const pauseTimer = useRef(0);
  const syncInProgress = useRef(false);
  const lastVersion = useRef(0);

  /** 非同期サーバー書き込み処理をキューイングし、自動ポーリングと衝突させない制御ラッパー */
  const runSyncTask = useCallback((taskFn) => {
    pauseTimer.current = Date.now() + MANUAL_ACTION_PAUSE_MS;
    syncQueue.current = syncQueue.current.then(async () => {
      syncInProgress.current = true;
      try {
        await taskFn();
      } catch (e) {
        console.error("サーバー同期エラー:", e);
      } finally {
        syncInProgress.current = false;
        pauseTimer.current = Date.now() + SYNC_COMPLETE_PAUSE_MS;
      }
    });
    return syncQueue.current;
  }, []);

  const applyVersion = useCallback((version) => {
    // 0 は未初期化を表すため、サーバーから有効値が来た時だけ更新する。
    if (version) {
      lastVersion.current = Number(version);
    }
  }, []);

  const getLastVersion = useCallback(() => lastVersion.current, []);

  // 手動更新の応答をポーリング結果が上書きしないよう、競合中は巡回を見送る。
  const shouldSkipPoll = useCallback(
    () => Date.now() < pauseTimer.current || syncInProgress.current,
    [],
  );

  return { runSyncTask, applyVersion, getLastVersion, shouldSkipPoll };
}
