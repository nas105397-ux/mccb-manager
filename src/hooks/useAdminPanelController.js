import { useMemo, useRef, useState } from 'react';
import {
  clearStarPrinterConnection,
  discoverStarPrinterConnection,
  loadStarPrinterConnection,
} from '../shared/starPrinterConnection';

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
  const [room, setRoom] = useState('');
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [newRoomInput, setNewRoomInput] = useState('');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [starPrinterConnection, setStarPrinterConnection] = useState(() =>
    loadStarPrinterConnection(),
  );
  const [starPrinterConnectionStatus, setStarPrinterConnectionStatus] = useState('');
  const [isConnectingStarPrinter, setIsConnectingStarPrinter] = useState(false);
  const [isTestingStarPrinter, setIsTestingStarPrinter] = useState(false);
  const csvInputRef = useRef(null);

  const currentGroup = useMemo(() => {
    return deviceGroups.find((g) => g.id === selectedGroupId);
  }, [deviceGroups, selectedGroupId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const selectedRoom = room || rooms[0] || '';
    const selectedCategory = category || categories[0] || '';

    if (!selectedRoom || !selectedCategory) {
      alert('電気室または区分が正しく設定されていません。マスター登録を確認してください。');
      return;
    }

    onSaveEntry({ room: selectedRoom, category: selectedCategory, name: name.trim() });
    setName('');
  };

  const handleExportCSV = () => {
    if (!mccbList || mccbList.length === 0) {
      alert('出力する設備データがありません。');
      return;
    }

    let csvContent = '電気室,区分,設備名称\n';
    mccbList.forEach((item) => {
      const cleanRoom = item.room.replace(/[,"]/g, '');
      const cleanCategory = item.category.replace(/[,"]/g, '');
      const cleanName = item.name.replace(/[,"]/g, '');
      csvContent += `${cleanRoom},${cleanCategory},${cleanName}\n`;
    });

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `登録設備データ_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVButtonClick = () => {
    csvInputRef.current?.click();
  };

  const handleEditRoomPrompt = (oldName) => {
    const res = window.prompt(`電気室「${oldName}」の新しい名称を入力してください:`, oldName);
    if (res && res.trim() && res.trim() !== oldName) {
      updateRoom(oldName, res.trim());
    }
  };

  const handleEditCategoryPrompt = (oldName) => {
    const res = window.prompt(`区分「${oldName}」の新しい名称を入力してください:`, oldName);
    if (res && res.trim() && res.trim() !== oldName) {
      updateCategory(oldName, res.trim());
    }
  };

  const handleAddRoom = () => {
    if (newRoomInput.trim()) {
      addRoom(newRoomInput.trim());
      setNewRoomInput('');
    }
  };

  const handleAddCategory = () => {
    if (newCategoryInput.trim()) {
      addCategory(newCategoryInput.trim());
      setNewCategoryInput('');
    }
  };

  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      addDeviceGroup(newGroupName.trim());
      setNewGroupName('');
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
    setStarPrinterConnectionStatus('プリンターを検索しています。ブラウザのUSB接続許可で対象プリンターを選択してください。');
    try {
      const connection = await discoverStarPrinterConnection();
      setStarPrinterConnection(connection);
      setStarPrinterConnectionStatus('プリンター接続情報を保存しました。');
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
    setStarPrinterConnectionStatus('保存済みのプリンター接続情報を削除しました。');
  };

  const handlePrintStarPrinterTestPage = async () => {
    if (isTestingStarPrinter) return;
    if (!starPrinterConnection) {
      setStarPrinterConnectionStatus('先にプリンター接続を完了してください。');
      return;
    }

    setIsTestingStarPrinter(true);
    setStarPrinterConnectionStatus('テスト印刷を送信しています。');
    try {
      const { printStarPrinterTestPage } = await import('../shared/starReceiptPrinter');
      await printStarPrinterTestPage();
      setStarPrinterConnectionStatus('テスト印刷を送信しました。');
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
    handleToggleDeviceInGroup,
    handleConnectStarPrinter,
    handleClearStarPrinterConnection,
    handlePrintStarPrinterTestPage,
  };
}
