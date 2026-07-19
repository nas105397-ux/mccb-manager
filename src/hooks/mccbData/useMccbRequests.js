// 停電作業依頼・仮発行依頼（自動スライド札割り当てシミュレーション）の状態と操作。
import { useCallback, useState } from "react";

export function useMccbRequests({
  runSyncTask,
  applyVersion,
  applyLogs,
  applyChangedMccbs,
  applyRequestHistory,
}) {
  const [requests, setRequests] = useState([]);
  const [draftRequests, setDraftRequests] = useState([]);

  const addRequest = useCallback(
    async (newRequest) => {
      let createdRequest = null;
      await runSyncTask(async () => {
        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: newRequest }),
        });

        if (!res.ok) {
          throw new Error(`停電作業依頼の発行に失敗しました (${res.status})`);
        }

        const result = await res.json();
        createdRequest = result.request || null;
        applyChangedMccbs(result.changedMccbs);
        if (Array.isArray(result.requests)) {
          setRequests(result.requests);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });

      if (!createdRequest) {
        throw new Error("停電作業依頼の発行結果を取得できませんでした。");
      }

      return createdRequest;
    },
    [applyChangedMccbs, applyLogs, applyVersion, runSyncTask],
  );

  const addDraftRequest = useCallback(
    async (newRequest) => {
      let createdDraft = null;
      await runSyncTask(async () => {
        const res = await fetch("/api/draft-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: newRequest }),
        });

        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            result?.error || `停電作業依頼の仮発行に失敗しました (${res.status})`,
          );
        }

        createdDraft = result.draftRequest || null;
        if (Array.isArray(result.draftRequests)) {
          setDraftRequests(result.draftRequests);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });

      if (!createdDraft) {
        throw new Error("停電作業依頼の仮発行結果を取得できませんでした。");
      }

      return createdDraft;
    },
    [applyLogs, applyVersion, runSyncTask],
  );

  const issueDraftRequest = useCallback(
    async (draftRequestId) => {
      let createdRequest = null;
      await runSyncTask(async () => {
        const res = await fetch(
          `/api/draft-requests/${encodeURIComponent(draftRequestId)}/issue`,
          { method: "POST" },
        );

        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            result?.error || `仮発行依頼の本発行に失敗しました (${res.status})`,
          );
        }

        createdRequest = result.request || null;
        applyChangedMccbs(result.changedMccbs);
        if (Array.isArray(result.requests)) {
          setRequests(result.requests);
        }
        if (Array.isArray(result.draftRequests)) {
          setDraftRequests(result.draftRequests);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });

      if (!createdRequest) {
        throw new Error("仮発行依頼の本発行結果を取得できませんでした。");
      }

      return createdRequest;
    },
    [applyChangedMccbs, applyLogs, applyVersion, runSyncTask],
  );

  const deleteDraftRequest = useCallback(
    (draftRequestId) => {
      setDraftRequests((prev) => prev.filter((req) => req.id !== draftRequestId));

      runSyncTask(async () => {
        const res = await fetch(
          `/api/draft-requests/${encodeURIComponent(draftRequestId)}`,
          { method: "DELETE" },
        );

        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            result?.error || `仮発行依頼の削除に失敗しました (${res.status})`,
          );
        }

        if (Array.isArray(result.draftRequests)) {
          setDraftRequests(result.draftRequests);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyVersion, runSyncTask],
  );

  const addTargetsToRequest = useCallback(
    (requestId, targetMccbIds, dummyNames = {}) => {
      runSyncTask(async () => {
        const res = await fetch(
          `/api/requests/${encodeURIComponent(requestId)}/targets`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetMccbIds, dummyNames }),
          },
        );

        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            result?.error || `停電作業依頼への設備追加に失敗しました (${res.status})`,
          );
        }

        applyChangedMccbs(result.changedMccbs);
        if (Array.isArray(result.requests)) {
          setRequests(result.requests);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyChangedMccbs, applyLogs, applyVersion, runSyncTask],
  );

  const updateRequestTargetCard = useCallback(
    (requestId, targetId, action) => {
      runSyncTask(async () => {
        const res = await fetch(
          `/api/requests/${encodeURIComponent(requestId)}/targets/${encodeURIComponent(targetId)}/card`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          },
        );

        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            result?.error || `停電作業依頼の子札操作に失敗しました (${res.status})`,
          );
        }

        applyChangedMccbs(result.changedMccbs);
        if (Array.isArray(result.requests)) {
          setRequests(result.requests);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyChangedMccbs, applyLogs, applyVersion, runSyncTask],
  );

  /** 停電作業依頼の解約・完了処理（使用札の解放） */
  const deleteRequest = useCallback(
    (id) => {
      // ローカル状態の先行切断
      setRequests((prev) => prev.filter((req) => req.id !== id));

      runSyncTask(async () => {
        const res = await fetch(`/api/requests/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          throw new Error(`停電作業依頼の完了処理に失敗しました (${res.status})`);
        }

        const result = await res.json();
        applyChangedMccbs(result.changedMccbs);
        if (Array.isArray(result.requests)) {
          setRequests(result.requests);
        }
        if (Array.isArray(result.requestHistory)) {
          applyRequestHistory(result.requestHistory);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyChangedMccbs, applyLogs, applyRequestHistory, applyVersion, runSyncTask],
  );

  return {
    requests,
    setRequests,
    draftRequests,
    setDraftRequests,
    addRequest,
    addDraftRequest,
    issueDraftRequest,
    deleteDraftRequest,
    addTargetsToRequest,
    updateRequestTargetCard,
    deleteRequest,
  };
}
