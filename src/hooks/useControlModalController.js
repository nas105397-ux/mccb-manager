import { useCallback, useMemo, useState } from 'react';
import {
  createStatusMessage,
  STATUS_MESSAGE_KEYS,
} from '../shared/statusMessages';

const createMasterDraft = (mccb) => ({
  room: mccb.room,
  category: mccb.category,
  name: mccb.name,
});

const updateChildCard = (childCards, cardId, updater) =>
  childCards.map((card) => (card.id === cardId ? updater(card) : card));

export function useControlModalController({ mccb, onUpdate, onUpdatePower }) {
  const [masterDrafts, setMasterDrafts] = useState({});
  const [modalMessage, setModalMessage] = useState(null);

  const currentDraft = masterDrafts[mccb.id] ?? createMasterDraft(mccb);

  const room = currentDraft.room;
  const category = currentDraft.category;
  const name = currentDraft.name;

  // 管理者編集欄は保存前の下書きをMCCB単位で保持し、モーダル再描画時の入力消失を防ぐ。
  const updateMasterDraft = useCallback((field, value) => {
    setMasterDrafts((prev) => ({
      ...prev,
      [mccb.id]: {
        ...(prev[mccb.id] ?? createMasterDraft(mccb)),
        [field]: value,
      },
    }));
  }, [mccb]);

  const setRoom = useCallback((value) => {
    updateMasterDraft('room', value);
  }, [updateMasterDraft]);

  const setCategory = useCallback((value) => {
    updateMasterDraft('category', value);
  }, [updateMasterDraft]);

  const setName = useCallback((value) => {
    updateMasterDraft('name', value);
  }, [updateMasterDraft]);

  const hasBorrowedCards = useMemo(() => {
    return mccb.childCards.some((card) => card.isBorrowed);
  }, [mccb.childCards]);

  const isSendingBlocked = useMemo(() => {
    return mccb.isPowerOff && hasBorrowedCards;
  }, [mccb.isPowerOff, hasBorrowedCards]);

  const handleTogglePower = useCallback(() => {
    if (isSendingBlocked) return;

    const nextStatus = !mccb.isPowerOff;
    if (onUpdatePower) {
      onUpdatePower(mccb.id, nextStatus);
      return;
    }

    onUpdate({ ...mccb, isPowerOff: nextStatus });
  }, [isSendingBlocked, mccb, onUpdate, onUpdatePower]);

  const handleReturnCard = useCallback((cardId) => {
    const updatedCards = updateChildCard(mccb.childCards, cardId, (card) => ({
      ...card,
      isBorrowed: false,
      workerName: '',
    }));

    onUpdate({ ...mccb, childCards: updatedCards });
  }, [mccb, onUpdate]);

  const handleBorrowCard = useCallback((cardId, workerName) => {
    const worker = workerName.trim();
    if (!worker) {
      alert('作業者名を入力してください。');
      return;
    }

    const updatedCards = updateChildCard(mccb.childCards, cardId, (card) => ({
      ...card,
      isBorrowed: true,
      workerName: worker,
    }));

    onUpdate({ ...mccb, childCards: updatedCards });
  }, [mccb, onUpdate]);

  const handleSaveMaster = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('設備名称を入力してください。');
      return;
    }

    onUpdate({ ...mccb, room, category, name: trimmedName });
    setModalMessage(createStatusMessage(STATUS_MESSAGE_KEYS.MASTER_UPDATED));
  }, [name, mccb, room, category, onUpdate]);

  return {
    isPowerOff: mccb.isPowerOff,
    room,
    setRoom,
    category,
    setCategory,
    name,
    setName,
    isSendingBlocked,
    modalMessage,
    setModalMessage,
    handleTogglePower,
    handleReturnCard,
    handleBorrowCard,
    handleSaveMaster,
  };
}
