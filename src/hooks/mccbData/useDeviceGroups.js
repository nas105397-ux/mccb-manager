// 一括設備グループマスターの状態と操作。
import { useCallback, useState } from "react";
import { LOG_TYPES } from "../../shared/appConstants";

export function useDeviceGroups({ runSyncTask, applyVersion, applyLogs }) {
  const [deviceGroups, setDeviceGroups] = useState([]);

  const addDeviceGroup = useCallback(
    (name) => {
      const newGroup = { id: `GROUP-${Date.now()}`, name, mccbIds: [] };
      const nextGroups = [...deviceGroups, newGroup];
      setDeviceGroups(nextGroups);
      runSyncTask(async () => {
        const res = await fetch("/api/admin/device-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceGroups: nextGroups,
            logType: LOG_TYPES.MASTER_CREATE,
            logMessage: `設備グループ「${name}」を新規作成しました。`,
          }),
        });
        if (!res.ok) throw new Error(`設備グループ作成に失敗しました (${res.status})`);
        const result = await res.json();
        if (Array.isArray(result.deviceGroups)) {
          setDeviceGroups(result.deviceGroups);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyVersion, deviceGroups, runSyncTask],
  );

  const updateDeviceGroup = useCallback(
    (id, updatedGroup, options = {}) => {
      const nextGroups = deviceGroups.map((g) =>
        g.id === id ? updatedGroup : g,
      );
      setDeviceGroups(nextGroups);
      runSyncTask(async () => {
        const res = await fetch("/api/admin/device-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceGroups: nextGroups,
            logType: options.logType || LOG_TYPES.MASTER_UPDATE,
            logMessage: options.logMessage,
          }),
        });
        if (!res.ok) throw new Error(`設備グループ更新に失敗しました (${res.status})`);
        const result = await res.json();
        if (Array.isArray(result.deviceGroups)) {
          setDeviceGroups(result.deviceGroups);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyVersion, deviceGroups, runSyncTask],
  );

  const deleteDeviceGroup = useCallback(
    (id) => {
      const groupToDelete = deviceGroups.find((g) => g.id === id);
      const nextGroups = deviceGroups.filter((g) => g.id !== id);
      setDeviceGroups(nextGroups);
      runSyncTask(async () => {
        const res = await fetch("/api/admin/device-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceGroups: nextGroups,
            logType: LOG_TYPES.MASTER_DELETE,
            logMessage: `設備グループ「${groupToDelete?.name}」を削除しました。`,
          }),
        });
        if (!res.ok) throw new Error(`設備グループ削除に失敗しました (${res.status})`);
        const result = await res.json();
        if (Array.isArray(result.deviceGroups)) {
          setDeviceGroups(result.deviceGroups);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyVersion, deviceGroups, runSyncTask],
  );

  return {
    deviceGroups,
    setDeviceGroups,
    addDeviceGroup,
    updateDeviceGroup,
    deleteDeviceGroup,
  };
}
