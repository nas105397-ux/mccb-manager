// 停電依頼作成フォームの入力、設備選択、印刷方式ごとの発行処理を管理する。
import { useCallback, useEffect, useMemo, useState } from "react";
import { REQUEST_PRINT_MODES } from "../shared/printSettings";
import {
  createStatusMessage,
  STATUS_MESSAGE_KEYS,
} from "../shared/statusMessages";
import { REQUEST_ID_PREFIX, matchesMccbSearch } from "../shared/mccbViewUtils";

const SEARCH_DEBOUNCE_MS = 200;

const waitForNextPaint = () =>
  // 通知メッセージをDOMへ反映してからブラウザの印刷ダイアログを開く。
  new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });

const createPreviewKey = (targetMccbIds, dummyNames) =>
  JSON.stringify({ targetMccbIds, dummyNames });

const generateRequestId = () => `${REQUEST_ID_PREFIX}${Date.now()}`;

const createRequestPayload = ({
  id,
  workerName,
  workContent,
  selectedMccbIds,
  dummyNames,
}) => ({
  id,
  timestamp: new Date().toLocaleString("ja-JP"),
  workerName,
  workContent,
  targetMccbIds: selectedMccbIds,
  dummyNames,
});

export function useRequestFormController({
  mccbList,
  onAddRequest,
  onAddDraftRequest,
  getPrintPreviewStatus,
  onAfterPrint,
  requestPrintMode = REQUEST_PRINT_MODES.NONE,
}) {
  // 入力フォーム状態
  const [workerName, setWorkerName] = useState("");
  const [workContent, setWorkContent] = useState("");
  const [selectedMccbIds, setSelectedMccbIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [dummyNames, setDummyNames] = useState({});
  const [isIssuingRequest, setIsIssuingRequest] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [formMessage, setFormMessage] = useState(null);
  // プレビューと発行結果の依頼番号を一致させるため、発行前に確定させておく。
  const [requestId, setRequestId] = useState(generateRequestId);

  // 検索入力のたびに大量の設備一覧を再フィルタしないよう、短時間だけ遅延させる。
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timerId);
  }, [searchQuery]);

  const selectedMccbIdSet = useMemo(
    () => new Set(selectedMccbIds),
    [selectedMccbIds],
  );

  const handleToggleMccb = useCallback((id) => {
    setFormMessage(null);
    setSelectedMccbIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const handleDummyNameChange = useCallback((id, value) => {
    setFormMessage(null);
    setDummyNames((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleSelectGroup = useCallback((groupMccbIds) => {
    if (!groupMccbIds?.length) return;

    setFormMessage(null);
    setSelectedMccbIds((prev) => {
      // 全件選択済みなら解除し、それ以外は既存選択を残したまま不足分を追加する。
      const prevSet = new Set(prev);
      const groupSet = new Set(groupMccbIds);
      const isAllSelected = groupMccbIds.every((id) => prevSet.has(id));
      return isAllSelected
        ? prev.filter((id) => !groupSet.has(id))
        : Array.from(new Set([...prev, ...groupMccbIds]));
    });
  }, []);

  const assertBrowserPrintPreviewReady = useCallback(() => {
    // 選択内容とプレビュー生成時のキーが一致する場合だけ印刷を許可する。
    const expectedPreviewKey = createPreviewKey(selectedMccbIds, dummyNames);
    const previewStatus = getPrintPreviewStatus?.();

    if (
      previewStatus?.isLoading ||
      previewStatus?.previewKey !== expectedPreviewKey
    ) {
      return "プレビュー作成中です。現在の停電対象設備一覧が表示されてから印刷してください。";
    }
    if (previewStatus?.error) return previewStatus.error;
    if (!previewStatus?.isReady) {
      return "印刷できる停電対象設備のプレビューがありません。";
    }
    return "";
  }, [dummyNames, getPrintPreviewStatus, selectedMccbIds]);

  const printByBrowser = useCallback(async () => {
    setFormMessage(createStatusMessage(STATUS_MESSAGE_KEYS.REQUEST_ISSUED));
    await waitForNextPaint();
    window.print();
    onAfterPrint?.();
  }, [onAfterPrint]);

  const printByStarReceipt = useCallback(
    async (createdRequest) => {
      if (!createdRequest) {
        alert(
          "停電依頼を発行しましたが、印刷用データを取得できませんでした。依頼一覧から再印刷してください。",
        );
        return;
      }

      try {
        // Star SDK はこの印刷方式を選んだ時だけ読み込み、初期表示を軽くする。
        const { printRequestReceipt } = await import(
          "../shared/starReceiptPrinter"
        );
        await printRequestReceipt(createdRequest, mccbList);
        setFormMessage(
          createStatusMessage(STATUS_MESSAGE_KEYS.REQUEST_RECEIPT_SENT),
        );
      } catch (error) {
        console.error(error);
        alert(
          `停電依頼は登録しましたが、レシート印刷に失敗しました。\n依頼一覧から再印刷できます。\n${error?.message || error}`,
        );
      }
    },
    [mccbList],
  );

  const handlePrint = useCallback(async () => {
    if (isIssuingRequest) return;
    setFormMessage(null);
    if (!workerName.trim()) {
      alert("作業者名を入力してください。");
      return;
    }
    if (selectedMccbIds.length === 0) {
      alert("設備が選択されていません。");
      return;
    }

    if (requestPrintMode === REQUEST_PRINT_MODES.BROWSER) {
      const previewError = assertBrowserPrintPreviewReady();
      if (previewError) {
        alert(previewError);
        return;
      }
    }

    setIsIssuingRequest(true);
    try {
      // プレビューで見せていたIDをそのまま使い、実際の依頼番号と一致させる。
      const createdRequest = await onAddRequest?.(
        createRequestPayload({
          id: requestId,
          workerName,
          workContent,
          selectedMccbIds,
          dummyNames,
        }),
      );
      setRequestId(generateRequestId());

      if (requestPrintMode === REQUEST_PRINT_MODES.BROWSER) {
        await printByBrowser();
      } else if (requestPrintMode === REQUEST_PRINT_MODES.STAR_RECEIPT) {
        await printByStarReceipt(createdRequest);
      } else {
        setFormMessage(createStatusMessage(STATUS_MESSAGE_KEYS.REQUEST_ISSUED));
      }
    } catch (error) {
      console.error(error);
      alert(error?.message || "停電依頼の発行に失敗しました。");
    } finally {
      setIsIssuingRequest(false);
    }
  }, [
    assertBrowserPrintPreviewReady,
    dummyNames,
    isIssuingRequest,
    onAddRequest,
    printByBrowser,
    printByStarReceipt,
    requestId,
    requestPrintMode,
    selectedMccbIds,
    workContent,
    workerName,
  ]);

  const handleSaveDraft = useCallback(async () => {
    if (isSavingDraft || isIssuingRequest) return;
    setFormMessage(null);
    if (!workerName.trim()) {
      alert("作業者名を入力してください。");
      return;
    }
    if (selectedMccbIds.length === 0) {
      alert("設備が選択されていません。");
      return;
    }

    setIsSavingDraft(true);
    try {
      // 仮発行では札を確保せず、入力内容だけを本発行用に保存する。
      // プレビューで見せていたIDをそのまま使い、実際の依頼番号と一致させる。
      await onAddDraftRequest?.(
        createRequestPayload({
          id: requestId,
          workerName,
          workContent,
          selectedMccbIds,
          dummyNames,
        }),
      );
      setRequestId(generateRequestId());
      setFormMessage(
        createStatusMessage(STATUS_MESSAGE_KEYS.REQUEST_DRAFT_SAVED),
      );
    } catch (error) {
      console.error(error);
      alert(error?.message || "停電依頼の仮発行に失敗しました。");
    } finally {
      setIsSavingDraft(false);
    }
  }, [
    dummyNames,
    isIssuingRequest,
    isSavingDraft,
    onAddDraftRequest,
    requestId,
    selectedMccbIds,
    workContent,
    workerName,
  ]);

  const filteredMccbList = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase().trim();
    if (!query) return mccbList;
    return mccbList.filter((mccb) => matchesMccbSearch(mccb, query));
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
    formMessage,
    setFormMessage,
    requestId,
    handleToggleMccb,
    handleDummyNameChange,
    handleSelectGroup,
    handlePrint,
    handleSaveDraft,
    isIssuingRequest,
    isSavingDraft,
  };
}
