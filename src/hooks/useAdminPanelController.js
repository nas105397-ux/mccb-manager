import { useMemo, useRef, useState } from 'react';

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
  };
}
