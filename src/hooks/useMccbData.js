import { useState, useEffect, useRef } from 'react';

const API_URL = '/api/mccb';
const DEFAULT_ROOMS = ['1階高圧電気室', '1階電気室', '2階電気室', '2次トーチ電気室', 'LT-UT電気室', '水処理電気室'];
const DEFAULT_CATEGORIES = ['1スト', '2スト', '3スト', '4スト', '5スト', '6スト', '共通'];
const POLL_INTERVAL = 3000;

export function useMccbData() {
  const [mccbList, setMccbList] = useState([]);
  const [rooms, setRooms] = useState(DEFAULT_ROOMS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [logs, setLogs] = useState([]);
  const [logSettings, setLogSettings] = useState({ maxSize: 500 });
  const [requests, setRequests] = useState([]);
  const [deviceGroups, setDeviceGroups] = useState([]);

  // 💡 【大改修】サーバー同期の「順番待ち列（キュー）」
  // 連打されても弾かず、順番に1つずつ確実に処理をこなします
  const syncQueue = useRef(Promise.resolve());
  const pauseTimer = useRef(0);

  const runSyncTask = (taskFn) => {
    pauseTimer.current = Date.now() + 3000; // 操作後3秒間は他のPCからの上書きを防ぐ
    syncQueue.current = syncQueue.current.then(async () => {
      try {
        await taskFn();
      } catch (e) {
        console.error("サーバー同期エラー:", e);
      }
    });
  };

  const getTimestamp = () => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
  };

  const createUpdatedLogs = (type, message, currentLogs, maxSize) => {
    const newLog = { id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, timestamp: getTimestamp(), type, message };
    return [newLog, ...currentLogs].slice(0, maxSize);
  };

  const parseServerData = (data) => {
    return {
      mccbList: data.mccbList || (Array.isArray(data) ? data : []),
      rooms: data.rooms || DEFAULT_ROOMS,
      categories: data.categories || DEFAULT_CATEGORIES,
      logs: data.logs || [],
      logSettings: data.logSettings || { maxSize: 500 },
      requests: data.requests || [],
      deviceGroups: data.deviceGroups || []
    };
  };

  useEffect(() => {
    const fetchData = () => {
      if (Date.now() < pauseTimer.current) return; // ユーザーが操作・連打している最中はポーリングを停止
      fetch(API_URL)
        .then(res => res.json())
        .then(data => {
          const parsed = parseServerData(data);
          setMccbList(parsed.mccbList); setRooms(parsed.rooms); setCategories(parsed.categories);
          setLogs(parsed.logs); setLogSettings(parsed.logSettings); setRequests(parsed.requests); setDeviceGroups(parsed.deviceGroups);
        })
        .catch(err => console.error("自動同期エラー:", err));
    };

    fetchData();
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const saveToServer = (nextMccbList, nextRooms = rooms, nextCategories = categories, nextLogs = logs, nextSettings = logSettings, nextRequests = requests, nextDeviceGroups = deviceGroups) => {
    setMccbList(nextMccbList); setRooms(nextRooms); setCategories(nextCategories); setLogs(nextLogs); setLogSettings(nextSettings); setRequests(nextRequests); setDeviceGroups(nextDeviceGroups);
    runSyncTask(async () => {
      await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mccbList: nextMccbList, rooms: nextRooms, categories: nextCategories, logs: nextLogs, logSettings: nextSettings, requests: nextRequests, deviceGroups: nextDeviceGroups })
      });
    });
  };

  const getBorrowedCount = (mccb) => mccb ? mccb.childCards.filter(c => c.isBorrowed).length : 0;

  const saveMccbEntry = (entry) => {
    const newMccb = { ...entry, id: `MCCB-${Date.now()}`, isPowerOff: false, isFavorite: false, childCards: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, isBorrowed: false, workerName: '' })) };
    saveToServer([...mccbList, newMccb], rooms, categories, createUpdatedLogs('マスタ登録', `設備「${entry.name}」が登録されました。`, logs, logSettings.maxSize));
  };

  // 💡 【超高速化】送電・停電・お気に入りの超サクサク処理
  const updateMccb = (updatedMccb) => {
    // 🚀 1. Optimistic UI: クリックした瞬間に画面を書き換える（もっさり解消！）
    setMccbList(prev => prev.map(item => item.id === updatedMccb.id ? updatedMccb : item));

    // 🚀 2. 裏側で順番に確実にサーバーへ送信する（連打しても絶対に取りこぼさない）
    runSyncTask(async () => {
      const res = await fetch(API_URL);
      const data = await res.json();
      const latest = parseServerData(data);

      const oldMccb = latest.mccbList.find(m => m.id === updatedMccb.id);
      let logMsg = ''; let logType = '操作';
      if (oldMccb) {
        if (oldMccb.isPowerOff !== updatedMccb.isPowerOff) { logMsg = `【${updatedMccb.room}】${updatedMccb.name} が「${updatedMccb.isPowerOff ? '🛑 停電中' : '🟢 送電中'}」に。`; }
        else if (oldMccb.isFavorite !== updatedMccb.isFavorite) { logMsg = `【${updatedMccb.room}】${updatedMccb.name} を「${updatedMccb.isFavorite ? '⭐ お気に入り登録' : 'お気に入り解除'}」しました。`; }
        else {
          const oldB = oldMccb.childCards.filter(c => c.isBorrowed).length; const newB = updatedMccb.childCards.filter(c => c.isBorrowed).length;
          if (oldB !== newB) {
            logType = '札貸出';
            logMsg = newB > oldB ? `【${updatedMccb.room}】${updatedMccb.name} の札が貸出されました。` : `【${updatedMccb.room}】${updatedMccb.name} の札が返却されました。`;
          }
        }
      }
      
      const nextList = latest.mccbList.map(item => item.id === updatedMccb.id ? updatedMccb : item);
      const nextLogs = logMsg ? createUpdatedLogs(logType, logMsg, latest.logs, latest.logSettings.maxSize) : latest.logs;

      await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...latest, mccbList: nextList, logs: nextLogs })
      });
    });
  };

  const deleteMccb = (id) => { if (window.confirm(`完全に削除してもよろしいですか？`)) saveToServer(mccbList.filter(item => item.id !== id), rooms, categories, createUpdatedLogs('マスタ削除', `設備データが削除されました。`, logs, logSettings.maxSize)); };
  const addRoom = (roomName) => { const trimmed = roomName.trim(); if (trimmed && !rooms.includes(trimmed)) saveToServer(mccbList, [...rooms, trimmed]); };
  const updateRoom = (oldName, newName) => { const trimmed = newName.trim(); if (trimmed && !rooms.includes(trimmed)) saveToServer(mccbList.map(m => m.room === oldName ? { ...m, room: trimmed } : m), rooms.map(r => r === oldName ? trimmed : r)); };
  const deleteRoom = (roomName) => { if (!mccbList.some(m => m.room === roomName) && window.confirm(`削除しますか？`)) saveToServer(mccbList, rooms.filter(r => r !== roomName)); };
  const addCategory = (categoryName) => { const trimmed = categoryName.trim(); if (trimmed && !categories.includes(trimmed)) saveToServer(mccbList, rooms, [...categories, trimmed]); };
  const updateCategory = (oldName, newName) => { const trimmed = newName.trim(); if (trimmed && !categories.includes(trimmed)) saveToServer(mccbList.map(m => m.category === oldName ? { ...m, category: trimmed } : m), rooms, categories.map(c => c === oldName ? trimmed : c)); };
  const deleteCategory = (categoryName) => { if (!mccbList.some(m => m.category === categoryName) && window.confirm(`削除しますか？`)) saveToServer(mccbList, rooms, categories.filter(c => c !== categoryName)); };
  const clearAllLogs = () => { if (window.confirm('ログ履歴をクリアしますか？')) saveToServer(mccbList, rooms, categories, [{ id: `LOG-${Date.now()}`, timestamp: getTimestamp(), type: 'システム', message: 'ログ履歴がクリアされました。' }]); };
  const changeMaxLogSize = (size) => saveToServer(mccbList, rooms, categories, createUpdatedLogs('設定変更', `ログ保持件数変更`, logs.slice(0, Number(size)), Number(size)), { ...logSettings, maxSize: Number(size) });

  const importFromCSV = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/);
      if (lines.length <= 1) { alert("インポート可能なデータ行が見つかりません。"); return; }
      const parsedEntries = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim(); if (!line) continue;
        const fields = line.split(',');
        if (fields.length >= 3) { parsedEntries.push({ room: fields[0].trim(), category: fields[1].trim(), name: fields[2].trim() }); }
      }
      if (parsedEntries.length > 0) {
        if (window.confirm(`⚠️ 注意 ⚠️\n現在登録されているすべての設備データを消去し、CSVの ${parsedEntries.length} 件で完全に【データ上書き】しますか？`)) {
          const newMccbList = parsedEntries.map((e, idx) => ({ ...e, id: `MCCB-${Date.now()}-${idx}`, isPowerOff: false, isFavorite: false, childCards: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, isBorrowed: false, workerName: '' })) }));
          saveToServer(newMccbList, rooms, categories, createUpdatedLogs('マスタ登録', `CSVから ${newMccbList.length} 件の設備データが一括上書きインポートされました。`, logs, logSettings.maxSize), logSettings, requests, deviceGroups);
          alert(`CSVから ${newMccbList.length} 件のマスタデータを正常に上書き取り込みしました。`);
        }
      } else { alert("有効なCSVデータが解析できませんでした。"); }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const addDeviceGroup = (name) => {
    const newGroup = { id: `GROUP-${Date.now()}`, name, mccbIds: [] };
    saveToServer(mccbList, rooms, categories, createUpdatedLogs('マスタ登録', `設備グループ「${name}」を新規作成しました。`, logs, logSettings.maxSize), logSettings, requests, [...deviceGroups, newGroup]);
  };
  const updateDeviceGroup = (id, updatedGroup) => { saveToServer(mccbList, rooms, categories, logs, logSettings, requests, deviceGroups.map(g => g.id === id ? updatedGroup : g)); };
  const deleteDeviceGroup = (id) => { const groupToDelete = deviceGroups.find(g => g.id === id); saveToServer(mccbList, rooms, categories, createUpdatedLogs('マスタ削除', `設備グループ「${groupToDelete?.name}」を削除しました。`, logs, logSettings.maxSize), logSettings, requests, deviceGroups.filter(g => g.id !== id)); };

  const addRequest = async (newRequest) => {
    runSyncTask(async () => {
      const res = await fetch(API_URL);
      const data = await res.json();
      const latest = parseServerData(data);

      let currentMccbList = latest.mccbList;
      let currentRequests = latest.requests;

      currentMccbList = currentMccbList.map(mccb => {
        const updatedCards = mccb.childCards.map(card => {
          let isBorrowed = card.isBorrowed;
          let workerName = card.workerName;
          currentRequests.forEach(req => {
            if (req.reservedCards) {
              Object.keys(req.reservedCards).forEach(tId => {
                const resInfo = req.reservedCards[tId];
                if (resInfo && resInfo.actualMccbId === mccb.id && resInfo.cardNo === card.id) { isBorrowed = true; workerName = req.workerName; }
              });
            }
          });
          return { ...card, isBorrowed, workerName };
        });
        return { ...mccb, childCards: updatedCards };
      });

      const reservedCards = {};

      for (const targetId of newRequest.targetMccbIds) {
        const originalMccb = currentMccbList.find(m => m.id === targetId);
        if (!originalMccb) continue;

        let availableIdx = originalMccb.childCards.findIndex(c => !c.isBorrowed);
        let finalTargetMccb = originalMccb;
        const isOriginalDummy = originalMccb.isDummy || originalMccb.name.includes('ダミー');

        if (availableIdx === -1 && !isOriginalDummy) {
          const dummyCandidates = currentMccbList.filter(m => m.room === originalMccb.room && (m.name.includes('ダミー') || m.id.includes('DUMMY') || m.isDummy));
          dummyCandidates.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
          let foundDummy = null; let dummyCardIdx = -1;

          for (const dummy of dummyCandidates) {
            let isOccupiedByOtherDevice = false;
            currentRequests.forEach(req => {
              if (!req.reservedCards) return;
              Object.keys(req.reservedCards).forEach(origId => { if (req.reservedCards[origId]?.actualMccbId === dummy.id && origId !== targetId) isOccupiedByOtherDevice = true; });
            });
            Object.keys(reservedCards).forEach(origId => { if (reservedCards[origId]?.actualMccbId === dummy.id && origId !== targetId) isOccupiedByOtherDevice = true; });
            dummy.childCards.forEach(card => {
              if (card.isBorrowed) {
                let isMyPastReservation = false;
                currentRequests.forEach(req => { if (req.reservedCards?.[targetId]?.actualMccbId === dummy.id && req.reservedCards[targetId].cardNo === card.id) isMyPastReservation = true; });
                if (!isMyPastReservation) isOccupiedByOtherDevice = true;
              }
            });
            if (isOccupiedByOtherDevice) continue;
            const idx = dummy.childCards.findIndex(c => !c.isBorrowed); if (idx !== -1) { foundDummy = dummy; dummyCardIdx = idx; break; }
          }

          if (!foundDummy) {
            const allDummies = currentMccbList.filter(m => m.name.includes('ダミー') || m.id.includes('DUMMY') || m.isDummy);
            allDummies.sort((a, b) => { if (a.name === 'ダミー0' && b.name !== 'ダミー0') return -1; if (a.name !== 'ダミー0' && b.name === 'ダミー0') return 1; return a.name.localeCompare(b.name, 'ja'); });
            for (const dummy of allDummies) {
              let isOccupiedByOtherDevice = false;
              currentRequests.forEach(req => { if (req.reservedCards) Object.keys(req.reservedCards).forEach(origId => { if (req.reservedCards[origId]?.actualMccbId === dummy.id && origId !== targetId) isOccupiedByOtherDevice = true; }); });
              Object.keys(reservedCards).forEach(origId => { if (reservedCards[origId]?.actualMccbId === dummy.id && origId !== targetId) isOccupiedByOtherDevice = true; });
              dummy.childCards.forEach(card => {
                if (card.isBorrowed) {
                  let isMyPastReservation = false;
                  currentRequests.forEach(req => { if (req.reservedCards?.[targetId]?.actualMccbId === dummy.id && req.reservedCards[targetId].cardNo === card.id) isMyPastReservation = true; });
                  if (!isMyPastReservation) isOccupiedByOtherDevice = true;
                }
              });
              if (isOccupiedByOtherDevice) continue;
              const idx = dummy.childCards.findIndex(c => !c.isBorrowed); if (idx !== -1) { foundDummy = dummy; dummyCardIdx = idx; break; }
            }
          }
          if (foundDummy) { finalTargetMccb = foundDummy; availableIdx = dummyCardIdx; }
        }

        if (availableIdx !== -1) {
          currentMccbList = currentMccbList.map(mccb => {
            if (mccb.id === finalTargetMccb.id) {
              const updatedCards = [...mccb.childCards];
              updatedCards[availableIdx] = { ...updatedCards[availableIdx], isBorrowed: true, workerName: newRequest.workerName };
              reservedCards[targetId] = { actualMccbId: finalTargetMccb.id, cardNo: updatedCards[availableIdx].id, displayName: finalTargetMccb.name, customDummyName: newRequest.dummyNames?.[targetId] || null };
              return { ...mccb, childCards: updatedCards };
            }
            return mccb;
          });
        } else { reservedCards[targetId] = { actualMccbId: null, cardNo: null, displayName: '空きなし', customDummyName: null }; }
      }

      const finalRequest = { ...newRequest, reservedCards };
      const nextRequests = [finalRequest, ...currentRequests];
      const nextLogs = createUpdatedLogs('操作', `👷 ${newRequest.workerName}氏の停電依頼を発行し、子札を予約ロックしました。`, latest.logs, latest.logSettings.maxSize);
      
      await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...latest, mccbList: currentMccbList, requests: nextRequests, logs: nextLogs })
      });

      // 処理完了後に画面へ反映
      setMccbList(currentMccbList); setRequests(nextRequests); setLogs(nextLogs);
    });
  };

  const deleteRequest = async (id) => {
    // 🚀 Optimistic UI: リストから瞬時に消す
    setRequests(prev => prev.filter(req => req.id !== id));

    runSyncTask(async () => {
      const res = await fetch(API_URL);
      const data = await res.json();
      const latest = parseServerData(data);

      let currentMccbList = latest.mccbList;
      let currentRequests = latest.requests;
      const reqToDelete = currentRequests.find(r => r.id === id);

      if (reqToDelete && reqToDelete.reservedCards) {
        Object.keys(reqToDelete.reservedCards).forEach(targetId => {
          const resInfo = reqToDelete.reservedCards[targetId];
          if (resInfo && resInfo.actualMccbId && resInfo.cardNo) {
            currentMccbList = currentMccbList.map(mccb => {
              if (mccb.id === resInfo.actualMccbId && mccb.childCards) {
                const cardIdx = mccb.childCards.findIndex(c => c.id === resInfo.cardNo);
                if (cardIdx !== -1) {
                  const card = mccb.childCards[cardIdx];
                  if (card.workerName === reqToDelete.workerName) {
                    const updatedCards = [...mccb.childCards];
                    updatedCards[cardIdx] = { ...card, isBorrowed: false, workerName: '' };
                    return { ...mccb, childCards: updatedCards };
                  }
                }
              }
              return mccb;
            });
          }
        });
      }

      const nextRequests = currentRequests.filter(req => req.id !== id);
      const nextLogs = createUpdatedLogs('操作', `依頼削除に伴い、使用されていた通常/ダミー子札が解放されました。`, latest.logs, latest.logSettings.maxSize);
      
      await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...latest, mccbList: currentMccbList, requests: nextRequests, logs: nextLogs })
      });

      setMccbList(currentMccbList); setRequests(nextRequests); setLogs(nextLogs);
    });
  };

  return {
    mccbList, rooms, categories, logs, logSettings, requests,
    deviceGroups, addDeviceGroup, updateDeviceGroup, deleteDeviceGroup,
    updateMccb, saveMccbEntry, deleteMccb, importFromCSV, getBorrowedCount,
    addRoom, updateRoom, deleteRoom, addCategory, updateCategory, deleteCategory,
    changeMaxLogSize, clearAllLogs, addRequest, deleteRequest
  };
}