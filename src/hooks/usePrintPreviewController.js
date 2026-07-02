import { useEffect, useMemo, useState } from 'react';

const REQUEST_PREVIEW_URL = '/api/requests/preview';

export function usePrintPreviewController({
  selectedMccbIds,
  dummyNames,
  previewRefreshNonce = 0,
}) {
  const { now, dateCode } = useMemo(() => {
    const currentDate = new Date();
    const code = `${currentDate.getFullYear().toString().slice(-2)}${(currentDate.getMonth() + 1).toString().padStart(2, '0')}${currentDate.getDate().toString().padStart(2, '0')}`;
    return { now: currentDate, dateCode: code };
  }, []);

  const previewRequest = useMemo(
    () => ({
      targetMccbIds: selectedMccbIds,
      dummyNames,
    }),
    [selectedMccbIds, dummyNames],
  );
  const previewKey = useMemo(
    () => JSON.stringify({ previewRequest, previewRefreshNonce }),
    [previewRequest, previewRefreshNonce],
  );
  const previewRequestKey = useMemo(
    () => JSON.stringify(previewRequest),
    [previewRequest],
  );
  const [previewState, setPreviewState] = useState({
    key: '',
    items: [],
    error: '',
  });

  useEffect(() => {
    const abortController = new AbortController();

    if (selectedMccbIds.length === 0) {
      return () => abortController.abort();
    }

    const timerId = window.setTimeout(() => {
      fetch(REQUEST_PREVIEW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          request: previewRequest,
        }),
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`プレビュー作成に失敗しました (${res.status})`);
          }
          return res.json();
        })
        .then((result) => {
          if (!abortController.signal.aborted) {
            setPreviewState({
              key: previewKey,
              items: result.previewItems || [],
              error: '',
            });
          }
        })
        .catch((error) => {
          if (error.name === 'AbortError') return;
          console.error('停電依頼プレビュー作成エラー:', error);
          setPreviewState({
            key: previewKey,
            items: [],
            error: error.message || 'プレビュー作成に失敗しました',
          });
        });
    }, 150);

    return () => {
      window.clearTimeout(timerId);
      abortController.abort();
    };
  }, [previewKey, previewRequest, selectedMccbIds.length]);

  const hasSelection = selectedMccbIds.length > 0;
  const isCurrentPreview = previewState.key === previewKey;
  const selectedMccbsWithAssignedCards =
    hasSelection && isCurrentPreview ? previewState.items : [];

  return {
    now,
    dateCode,
    previewRequestKey,
    selectedMccbsWithAssignedCards,
    isPreviewLoading: hasSelection && !isCurrentPreview,
    previewError: hasSelection && isCurrentPreview ? previewState.error : '',
  };
}
