// MCCB本体マスタ・電気室・区分（送電状態、CSV一括登録を含む）の状態と操作。
import { useCallback, useState } from "react";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_ROOMS,
} from "../../shared/appConstants";
import { normalizeCategoryColors } from "../../shared/categoryColorUtils";
import { API_URL } from "./constants";
import { mergeChangedMccbsByChildCards } from "./utils";

export function useMccbCore({
  runSyncTask,
  applyVersion,
  applyLogs,
  applyLogsInTransition,
  setDeviceGroups,
}) {
  const [mccbList, setMccbList] = useState([]);
  const [rooms, setRooms] = useState(DEFAULT_ROOMS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [categoryColors, setCategoryColors] = useState(() =>
    normalizeCategoryColors(DEFAULT_CATEGORIES),
  );

  // 停電作業依頼APIが返す「子札状態が変わったMCCBだけ」をローカル一覧へ反映する。
  const applyChangedMccbs = useCallback((changedMccbs) => {
    if (!Array.isArray(changedMccbs)) return;
    setMccbList((prev) => mergeChangedMccbsByChildCards(prev, changedMccbs));
  }, []);

  /** 設備の個別新規マスタ登録 */
  const saveMccbEntry = useCallback(
    (entry) => {
      runSyncTask(async () => {
        const res = await fetch("/api/mccbs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mccb: entry }),
        });
        if (!res.ok) throw new Error(`設備登録に失敗しました (${res.status})`);
        const result = await res.json();
        if (result.mccb) {
          setMccbList((prev) => [...prev, result.mccb]);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyVersion, runSyncTask],
  );

  /** 設備データ（開閉状態・お気に入り・子札貸出）の更新操作 */
  const updateMccb = useCallback(
    (updatedMccb) => {
      // UIの応答性を高めるため先にローカル状態を先行更新
      setMccbList((prev) =>
        prev.map((item) => (item.id === updatedMccb.id ? updatedMccb : item)),
      );

      runSyncTask(async () => {
        const res = await fetch(`${API_URL}/${encodeURIComponent(updatedMccb.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mccb: updatedMccb }),
        });

        if (!res.ok) {
          throw new Error(`設備更新に失敗しました (${res.status})`);
        }

        const result = await res.json();
        if (result.mccb) {
          setMccbList((prev) =>
            prev.map((item) => (item.id === result.mccb.id ? result.mccb : item)),
          );
        }
        if (Array.isArray(result.logs)) applyLogsInTransition(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogsInTransition, applyVersion, runSyncTask],
  );

  /** 停電・送電状態だけを更新する軽量操作 */
  const updateMccbPower = useCallback(
    (id, isPowerOff) => {
      let previousMccb = null;
      // 操作直後に表示へ反映し、通信失敗時にだけ直前の状態へ戻す。
      setMccbList((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          previousMccb = item;
          return { ...item, isPowerOff };
        }),
      );

      runSyncTask(async () => {
        try {
          const res = await fetch(`${API_URL}/${encodeURIComponent(id)}/power`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isPowerOff }),
          });

          const result = await res.json().catch(() => ({}));
          if (!res.ok) {
            const message =
              result?.error || `停電・送電状態の更新に失敗しました (${res.status})`;
            throw new Error(message);
          }

          if (result.mccb) {
            setMccbList((prev) =>
              prev.map((item) => (item.id === result.mccb.id ? result.mccb : item)),
            );
          }
          if (Array.isArray(result.logs)) applyLogsInTransition(result.logs);
          applyVersion(result.version);
        } catch (error) {
          // その後に別操作が行われていれば、新しい状態を誤って巻き戻さない。
          if (previousMccb) {
            setMccbList((prev) =>
              prev.map((item) =>
                item.id === id && item.isPowerOff === isPowerOff
                  ? previousMccb
                  : item,
              ),
            );
          }
          alert(error.message || "停電・送電状態の更新に失敗しました。");
        }
      });
    },
    [applyLogsInTransition, applyVersion, runSyncTask],
  );

  /** 設備マスタの完全削除 */
  const deleteMccb = useCallback(
    (id) => {
      if (window.confirm("完全に削除してもよろしいですか？")) {
        setMccbList((prev) => prev.filter((item) => item.id !== id));
        runSyncTask(async () => {
          const res = await fetch(`/api/mccbs/${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error(`設備削除に失敗しました (${res.status})`);
          const result = await res.json();
          if (result.deletedId) {
            setMccbList((prev) =>
              prev.filter((item) => item.id !== result.deletedId),
            );
          }
          if (Array.isArray(result.logs)) applyLogs(result.logs);
          applyVersion(result.version);
        });
      }
    },
    [applyLogs, applyVersion, runSyncTask],
  );

  // --- マスター項目（電気室・区分）制御 ---
  const addRoom = useCallback(
    (roomName) => {
      const trimmed = roomName.trim();
      if (trimmed && !rooms.includes(trimmed)) {
        const nextRooms = [...rooms, trimmed];
        setRooms(nextRooms);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/rooms", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rooms: nextRooms, mccbList }),
          });
          if (!res.ok) throw new Error(`電気室追加に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.rooms)) setRooms(result.rooms);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, mccbList, rooms, runSyncTask],
  );

  const updateRoom = useCallback(
    (oldName, newName) => {
      const trimmed = newName.trim();
      if (trimmed && !rooms.includes(trimmed)) {
        const nextList = mccbList.map((m) =>
          m.room === oldName ? { ...m, room: trimmed } : m,
        );
        const nextRooms = rooms.map((r) => (r === oldName ? trimmed : r));
        setMccbList(nextList);
        setRooms(nextRooms);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/rooms", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rooms: nextRooms, mccbList: nextList }),
          });
          if (!res.ok) throw new Error(`電気室編集に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.rooms)) setRooms(result.rooms);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, mccbList, rooms, runSyncTask],
  );

  const deleteRoom = useCallback(
    (roomName) => {
      if (
        !mccbList.some((m) => m.room === roomName) &&
        window.confirm("削除しますか？")
      ) {
        const nextRooms = rooms.filter((r) => r !== roomName);
        setRooms(nextRooms);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/rooms", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rooms: nextRooms, mccbList }),
          });
          if (!res.ok) throw new Error(`電気室削除に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.rooms)) setRooms(result.rooms);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, mccbList, rooms, runSyncTask],
  );

  const addCategory = useCallback(
    (categoryName) => {
      const trimmed = categoryName.trim();
      if (trimmed && !categories.includes(trimmed)) {
        const nextCategories = [...categories, trimmed];
        const nextCategoryColors = normalizeCategoryColors(nextCategories, {
          ...categoryColors,
        });
        setCategories(nextCategories);
        setCategoryColors(nextCategoryColors);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/categories", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categories: nextCategories,
              categoryColors: nextCategoryColors,
              mccbList,
            }),
          });
          if (!res.ok) throw new Error(`区分追加に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.categories)) setCategories(result.categories);
          if (result.categoryColors) setCategoryColors(result.categoryColors);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, categories, categoryColors, mccbList, runSyncTask],
  );

  const updateCategory = useCallback(
    (oldName, newName) => {
      const trimmed = newName.trim();
      if (trimmed && !categories.includes(trimmed)) {
        const nextList = mccbList.map((m) =>
          m.category === oldName ? { ...m, category: trimmed } : m,
        );
        const nextCats = categories.map((c) => (c === oldName ? trimmed : c));
        const nextCategoryColors = normalizeCategoryColors(nextCats, {
          ...categoryColors,
          [trimmed]: categoryColors[oldName],
        });
        setMccbList(nextList);
        setCategories(nextCats);
        setCategoryColors(nextCategoryColors);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/categories", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categories: nextCats,
              categoryColors: nextCategoryColors,
              mccbList: nextList,
            }),
          });
          if (!res.ok) throw new Error(`区分編集に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.categories)) setCategories(result.categories);
          if (result.categoryColors) setCategoryColors(result.categoryColors);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, categories, categoryColors, mccbList, runSyncTask],
  );

  const deleteCategory = useCallback(
    (categoryName) => {
      if (
        !mccbList.some((m) => m.category === categoryName) &&
        window.confirm("削除しますか？")
      ) {
        const nextCategories = categories.filter((c) => c !== categoryName);
        const nextCategoryColors = normalizeCategoryColors(
          nextCategories,
          categoryColors,
        );
        setCategories(nextCategories);
        setCategoryColors(nextCategoryColors);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/categories", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categories: nextCategories,
              categoryColors: nextCategoryColors,
              mccbList,
            }),
          });
          if (!res.ok) throw new Error(`区分削除に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.categories)) setCategories(result.categories);
          if (result.categoryColors) setCategoryColors(result.categoryColors);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, categories, categoryColors, mccbList, runSyncTask],
  );

  const updateCategoryColor = useCallback(
    (categoryName, colorKey) => {
      if (!categories.includes(categoryName)) return;

      const nextCategoryColors = normalizeCategoryColors(categories, {
        ...categoryColors,
        [categoryName]: colorKey,
      });
      setCategoryColors(nextCategoryColors);

      runSyncTask(async () => {
        const res = await fetch("/api/admin/category-colors", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryColors: nextCategoryColors }),
        });
        if (!res.ok) throw new Error(`区分色変更に失敗しました (${res.status})`);
        const result = await res.json();
        if (result.categoryColors) setCategoryColors(result.categoryColors);
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyVersion, categories, categoryColors, runSyncTask],
  );

  // --- CSV一括インポートインジェクション ---
  const importFromCSV = useCallback(
    (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split(/\r?\n/);
        if (lines.length <= 1) {
          alert("インポート可能なデータ行が見つかりません。");
          return;
        }

        const parsedEntries = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const fields = line.split(",");
          if (fields.length >= 3) {
            parsedEntries.push({
              room: fields[0].trim(),
              category: fields[1].trim(),
              name: fields[2].trim(),
            });
          }
        }

        const roomSet = new Set(rooms);
        const categorySet = new Set(categories);
        const invalidEntries = parsedEntries
          .map((entry, index) => ({
            lineNumber: index + 2,
            roomValid: roomSet.has(entry.room),
            categoryValid: categorySet.has(entry.category),
            entry,
          }))
          .filter(
            ({ roomValid, categoryValid }) => !roomValid || !categoryValid,
          );

        if (invalidEntries.length > 0) {
          const invalidDetails = invalidEntries
            .slice(0, 10)
            .map(({ lineNumber, roomValid, categoryValid, entry }) => {
              const reasons = [];
              if (!roomValid)
                reasons.push(`電気室「${entry.room || "(空欄)"}」`);
              if (!categoryValid)
                reasons.push(`区分「${entry.category || "(空欄)"}」`);
              return `${lineNumber}行目: ${reasons.join(" / ")} がマスター未登録です。`;
            })
            .join("\n");
          const omittedCount =
            invalidEntries.length > 10
              ? `\n...ほか ${invalidEntries.length - 10} 件`
              : "";
          alert(
            `CSV取込を中止しました。電気室または区分がマスターと一致しない行があります。\n\n${invalidDetails}${omittedCount}`,
          );
          return;
        }

        if (parsedEntries.length > 0) {
          if (
            window.confirm(
              `⚠️ 注意 ⚠️\n現在登録されているすべての設備データを消去し、CSVの ${parsedEntries.length} 件で完全に【データ上書き】しますか？`,
            )
          ) {
            runSyncTask(async () => {
              const res = await fetch("/api/admin/mccb-import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entries: parsedEntries }),
              });
              if (!res.ok) throw new Error(`CSV取込に失敗しました (${res.status})`);

              const result = await res.json();
              if (Array.isArray(result.mccbList)) {
                setMccbList(result.mccbList);
              }
              if (Array.isArray(result.deviceGroups)) {
                setDeviceGroups(result.deviceGroups);
              }
              if (Array.isArray(result.logs)) {
                applyLogs(result.logs);
              }
              applyVersion(result.version);
              alert(
                `CSVから ${parsedEntries.length} 件のマスタデータを正常に上書き取り込みしました。`,
              );
            });
          }
        } else {
          alert("有効なCSVデータが解析できませんでした。");
        }
      };
      reader.readAsText(file, "UTF-8");
    },
    [rooms, categories, applyLogs, applyVersion, runSyncTask, setDeviceGroups],
  );

  return {
    mccbList,
    setMccbList,
    rooms,
    setRooms,
    categories,
    setCategories,
    categoryColors,
    setCategoryColors,
    applyChangedMccbs,
    saveMccbEntry,
    updateMccb,
    updateMccbPower,
    deleteMccb,
    importFromCSV,
    addRoom,
    updateRoom,
    deleteRoom,
    addCategory,
    updateCategory,
    deleteCategory,
    updateCategoryColor,
  };
}
