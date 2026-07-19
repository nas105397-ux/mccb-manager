// 管理画面のフォーム状態、CSV 出力、マスター編集、Starプリンター接続を束ねる。
import { useMemo, useRef, useState } from "react";
import {
  clearStarPrinterConnection,
  discoverStarPrinterConnection,
  loadStarPrinterConnection,
} from "../shared/starPrinterConnection";

const CSV_HEADER = "電気室,区分,設備名称\n";
const CSV_BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);

const normalizeCsvCell = (value = "") => String(value).replace(/[,"]/g, "");

const buildMccbCsv = (mccbList) =>
  mccbList.reduce((csvContent, item) => {
    const row = [item.room, item.category, item.name]
      .map(normalizeCsvCell)
      .join(",");
    return `${csvContent}${row}\n`;
  }, CSV_HEADER);

const downloadTextFile = ({ content, fileName, type }) => {
  const blob = new Blob([CSV_BOM, content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const getTodayString = () => new Date().toISOString().slice(0, 10);

// window.prompt で新しい名称を受け取り、未入力・変更なしの場合は何もしない。
const promptRename = (label, oldName, onRename) => {
  const nextName = window.prompt(`${label}「${oldName}」の新しい名称を入力してください:`, oldName)?.trim();
  if (!nextName || nextName === oldName) return;
  onRename(nextName);
};

export function useAdminPanelController({
  onSaveEntry,
  mccbList,
  rooms,
  categories,
  addRoom,
  updateRoom,
  addCategory,
  updateCategory,
  deviceGroups,
  addDeviceGroup,
  updateDeviceGroup,
  deleteDeviceGroup,
}) {
  // マスター登録フォーム・管理UIの一時入力値
  const [room, setRoom] = useState("");
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [newRoomInput, setNewRoomInput] = useState("");
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  // スター精密プリンター接続はブラウザ端末ごとに保存・検証する。
  const [starPrinterConnection, setStarPrinterConnection] = useState(() =>
    loadStarPrinterConnection(),
  );
  const [starPrinterConnectionStatus, setStarPrinterConnectionStatus] = useState("");
  const [isConnectingStarPrinter, setIsConnectingStarPrinter] = useState(false);
  const [isTestingStarPrinter, setIsTestingStarPrinter] = useState(false);
  const csvInputRef = useRef(null);

  const currentGroup = useMemo(() => {
    return deviceGroups.find((g) => g.id === selectedGroupId);
  }, [deviceGroups, selectedGroupId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const selectedRoom = room || rooms[0] || "";
    const selectedCategory = category || categories[0] || "";

    if (!selectedRoom || !selectedCategory) {
      alert("電気室または区分が正しく設定されていません。マスター登録を確認してください。");
      return;
    }

    onSaveEntry({ room: selectedRoom, category: selectedCategory, name: name.trim() });
    setName("");
  };

  const handleExportCSV = () => {
    if (!mccbList || mccbList.length === 0) {
      alert("出力する設備データがありません。");
      return;
    }

    downloadTextFile({
      content: buildMccbCsv(mccbList),
      fileName: `登録設備データ_${getTodayString()}.csv`,
      type: "text/csv;charset=utf-8;",
    });
  };

  const handleCSVButtonClick = () => {
    csvInputRef.current?.click();
  };

  const handleEditRoomPrompt = (oldName) =>
    promptRename("電気室", oldName, (nextName) => updateRoom(oldName, nextName));

  const handleEditCategoryPrompt = (oldName) =>
    promptRename("区分", oldName, (nextName) => updateCategory(oldName, nextName));

  const handleAddRoom = () => {
    if (newRoomInput.trim()) {
      addRoom(newRoomInput.trim());
      setNewRoomInput("");
    }
  };

  const handleAddCategory = () => {
    if (newCategoryInput.trim()) {
      addCategory(newCategoryInput.trim());
      setNewCategoryInput("");
    }
  };

  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      addDeviceGroup(newGroupName.trim());
      setNewGroupName("");
    }
  };

  const handleDeleteGroup = (group, e) => {
    e.stopPropagation();
    if (window.confirm(`グループ「${group.name}」を削除しますか？`)) {
      deleteDeviceGroup(group.id);
      if (selectedGroupId === group.id) {
        setSelectedGroupId(null);
      }
    }
  };

  const handleEditGroupPrompt = (group, e) => {
    e.stopPropagation();
    const oldName = group.name || "";

    promptRename("グループ", oldName, (nextName) => {
      if (deviceGroups.some((g) => g.id !== group.id && g.name === nextName)) {
        alert(`グループ「${nextName}」は既に存在します。`);
        return;
      }

      updateDeviceGroup(
        group.id,
        { ...group, name: nextName },
        {
          logMessage: `設備グループ「${oldName}」を「${nextName}」に名称変更しました。`,
        },
      );
    });
  };

  const handleToggleDeviceInGroup = (deviceId) => {
    if (!currentGroup) return;

    let updatedIds = [...(currentGroup.mccbIds || [])];
    if (updatedIds.includes(deviceId)) {
      updatedIds = updatedIds.filter((id) => id !== deviceId);
    } else {
      updatedIds.push(deviceId);
    }

    updateDeviceGroup(currentGroup.id, { ...currentGroup, mccbIds: updatedIds });
  };

  const handleConnectStarPrinter = async () => {
    if (isConnectingStarPrinter) return;

    setIsConnectingStarPrinter(true);
    setStarPrinterConnectionStatus("プリンターを検索しています。ブラウザのUSB接続許可で対象プリンターを選択してください。");
    try {
      const connection = await discoverStarPrinterConnection();
      setStarPrinterConnection(connection);
      setStarPrinterConnectionStatus("プリンター接続情報を保存しました。");
    } catch (error) {
      console.error(error);
      setStarPrinterConnectionStatus(`接続に失敗しました: ${error?.message || error}`);
    } finally {
      setIsConnectingStarPrinter(false);
    }
  };

  const handleClearStarPrinterConnection = () => {
    clearStarPrinterConnection();
    setStarPrinterConnection(null);
    setStarPrinterConnectionStatus("保存済みのプリンター接続情報を削除しました。");
  };

  const handlePrintStarPrinterTestPage = async () => {
    if (isTestingStarPrinter) return;
    if (!starPrinterConnection) {
      setStarPrinterConnectionStatus("先にプリンター接続を完了してください。");
      return;
    }

    setIsTestingStarPrinter(true);
    setStarPrinterConnectionStatus("テスト印刷を送信しています。");
    try {
      const { printStarPrinterTestPage } = await import("../shared/starReceiptPrinter");
      await printStarPrinterTestPage();
      setStarPrinterConnectionStatus("テスト印刷を送信しました。");
    } catch (error) {
      console.error(error);
      setStarPrinterConnectionStatus(`テスト印刷に失敗しました: ${error?.message || error}`);
    } finally {
      setIsTestingStarPrinter(false);
    }
  };

  return {
    room,
    setRoom,
    category,
    setCategory,
    name,
    setName,
    newRoomInput,
    setNewRoomInput,
    newCategoryInput,
    setNewCategoryInput,
    newGroupName,
    setNewGroupName,
    selectedGroupId,
    setSelectedGroupId,
    currentGroup,
    starPrinterConnection,
    starPrinterConnectionStatus,
    isConnectingStarPrinter,
    isTestingStarPrinter,
    csvInputRef,
    handleSubmit,
    handleExportCSV,
    handleCSVButtonClick,
    handleEditRoomPrompt,
    handleEditCategoryPrompt,
    handleAddRoom,
    handleAddCategory,
    handleCreateGroup,
    handleDeleteGroup,
    handleEditGroupPrompt,
    handleToggleDeviceInGroup,
    handleConnectStarPrinter,
    handleClearStarPrinterConnection,
    handlePrintStarPrinterTestPage,
  };
}
