import { useCallback, useMemo, useState } from 'react';

export function useControlModalController({ mccb, onUpdate }) {
  const [masterDrafts, setMasterDrafts] = useState({});

  const currentDraft = masterDrafts[mccb.id] ?? {
    room: mccb.room,
    category: mccb.category,
    name: mccb.name,
  };

  const room = currentDraft.room;
  const category = currentDraft.category;
  const name = currentDraft.name;

  const setRoom = useCallback((value) => {
    setMasterDrafts((prev) => ({
      ...prev,
      [mccb.id]: {
        ...(prev[mccb.id] ?? { room: mccb.room, category: mccb.category, name: mccb.name }),
        room: value,
      },
    }));
  }, [mccb.id, mccb.room, mccb.category, mccb.name]);

  const setCategory = useCallback((value) => {
    setMasterDrafts((prev) => ({
      ...prev,
      [mccb.id]: {
        ...(prev[mccb.id] ?? { room: mccb.room, category: mccb.category, name: mccb.name }),
        category: value,
      },
    }));
  }, [mccb.id, mccb.room, mccb.category, mccb.name]);

  const setName = useCallback((value) => {
    setMasterDrafts((prev) => ({
      ...prev,
      [mccb.id]: {
        ...(prev[mccb.id] ?? { room: mccb.room, category: mccb.category, name: mccb.name }),
        name: value,
      },
    }));
  }, [mccb.id, mccb.room, mccb.category, mccb.name]);

  const hasBorrowedCards = useMemo(() => {
    return mccb.childCards.some((card) => card.isBorrowed);
  }, [mccb.childCards]);

  const isSendingBlocked = useMemo(() => {
    return mccb.isPowerOff && hasBorrowedCards;
  }, [mccb.isPowerOff, hasBorrowedCards]);

  const handleTogglePower = useCallback(() => {
    if (isSendingBlocked) return;

    const nextStatus = !mccb.isPowerOff;
    onUpdate({ ...mccb, isPowerOff: nextStatus });
  }, [isSendingBlocked, mccb, onUpdate]);

  const handleReturnCard = useCallback((cardId) => {
    const updatedCards = mccb.childCards.map((card) => {
      if (card.id !== cardId) return card;
      return { ...card, isBorrowed: false, workerName: '' };
    });

    onUpdate({ ...mccb, childCards: updatedCards });
  }, [mccb, onUpdate]);

  const handleBorrowCard = useCallback((cardId, workerName) => {
    const worker = workerName.trim();
    if (!worker) {
      alert('作業者名を入力してください。');
      return;
    }

    const updatedCards = mccb.childCards.map((card) => {
      if (card.id !== cardId) return card;
      return { ...card, isBorrowed: true, workerName: worker };
    });

    onUpdate({ ...mccb, childCards: updatedCards });
  }, [mccb, onUpdate]);

  const handleSaveMaster = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('設備名称を入力してください。');
      return;
    }

    onUpdate({ ...mccb, room, category, name: trimmedName });
    alert('設備情報を更新しました。');
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
    handleTogglePower,
    handleReturnCard,
    handleBorrowCard,
    handleSaveMaster,
  };
}
