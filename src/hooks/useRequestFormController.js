import { useCallback, useEffect, useMemo, useState } from 'react';
import { PRINT_DRIVERS, getSavedPrintDriver, printRequestWithStar, savePrintDriver } from '../shared/starReceiptPrinter';

const waitForNextPaint = () =>
  new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });

export function useRequestFormController({
  mccbList,
  onAddRequest,
  getPrintPreviewStatus,
  onAfterPrint,
  getPrintReceiptData,
}) {
  const [workerName, setWorkerName]         = useState('');
  const [workContent, setWorkContent]       = useState('');
  const [selectedMccbIds, setSelectedMccbIds] = useState([]);
  const [searchQuery, setSearchQuery]       = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [dummyNames, setDummyNames]         = useState({});
  const [isIssuingRequest, setIsIssuingRequest] = useState(false);
  const [printDriver, setPrintDriverState] = useState(getSavedPrintDriver);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);

    return () => window.clearTimeout(timerId);
  }, [searchQuery]);

  const selectedMccbIdSet = useMemo(
    () => new Set(selectedMccbIds),
    [selectedMccbIds],
  );

  const handleToggleMccb = useCallback((id) => {
    setSelectedMccbIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const handleDummyNameChange = useCallback((id, value) => {
    setDummyNames((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleSelectGroup = useCallback((groupMccbIds) => {
    if (!groupMccbIds?.length) return;

    setSelectedMccbIds((prev) => {
      const prevSet = new Set(prev);
      const groupSet = new Set(groupMccbIds);
      const isAllSelected = groupMccbIds.every((id) => prevSet.has(id));
      return isAllSelected
        ? prev.filter((id) => !groupSet.has(id))
        : Array.from(new Set([...prev, ...groupMccbIds]));
    });
  }, []);

  const setPrintDriver = useCallback((driver) => {
    setPrintDriverState(driver);
    savePrintDriver(driver);
  }, []);

  const printBySelectedDriver = useCallback(async () => {
    if (printDriver !== PRINT_DRIVERS.star) {
      window.print();
      return;
    }

    try {
      await printRequestWithStar(getPrintReceiptData?.());
    } catch (error) {
      console.error('StarXpand印刷エラー:', error);
      alert(`Starプリンター印刷に失敗しました。従来のブラウザー印刷に切り替えます。\n${error?.message || error}`);
      window.print();
    }
  }, [printDriver, getPrintReceiptData]);

  const handlePrint = useCallback(async () => {
    if (isIssuingRequest) return;
    if (!workerName.trim()) { alert('作業者名を入力してください。'); return; }
    if (selectedMccbIds.length === 0) { alert('設備が選択されていません。'); return; }

    const expectedPreviewKey = JSON.stringify({
      targetMccbIds: selectedMccbIds,
      dummyNames,
    });
    const previewStatus = getPrintPreviewStatus?.();
    if (previewStatus?.isLoading || previewStatus?.previewKey !== expectedPreviewKey) {
      alert('プレビュー作成中です。現在の停電対象設備一覧が表示されてから印刷してください。');
      return;
    }
    if (previewStatus?.error) {
      alert(previewStatus.error);
      return;
    }
    if (!previewStatus?.isReady) {
      alert('印刷できる停電対象設備のプレビューがありません。');
      return;
    }

    setIsIssuingRequest(true);
    try {
      await onAddRequest?.({
        id: `REQ-${Date.now()}`,
        timestamp: new Date().toLocaleString('ja-JP'),
        workerName,
        workContent,
        targetMccbIds: selectedMccbIds,
        dummyNames,
      });
      alert('停電依頼を発行し、一覧へ登録しました。');
      await waitForNextPaint();
      await printBySelectedDriver();
      onAfterPrint?.();
    } finally {
      setIsIssuingRequest(false);
    }
  }, [
    isIssuingRequest,
    workerName,
    workContent,
    selectedMccbIds,
    dummyNames,
    onAddRequest,
    getPrintPreviewStatus,
    onAfterPrint,
    printBySelectedDriver,
  ]);

  const filteredMccbList = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase().trim();
    if (!query) return mccbList;
    return mccbList.filter(
      (mccb) =>
        mccb.name?.toLowerCase().includes(query) ||
        mccb.room?.toLowerCase().includes(query)
    );
  }, [mccbList, debouncedSearchQuery]);

  return {
    workerName,
    setWorkerName,
    workContent,
    setWorkContent,
    selectedMccbIds,
    searchQuery,
    setSearchQuery,
    dummyNames,
    selectedMccbIdSet,
    filteredMccbList,
    handleToggleMccb,
    handleDummyNameChange,
    handleSelectGroup,
    handlePrint,
    isIssuingRequest,
    printDriver,
    setPrintDriver,
  };
}
