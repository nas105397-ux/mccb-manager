// 依頼票バーコード読み取りをキーボード入力として受け、対象依頼の完了確認へつなぐ。
import { useCallback, useEffect, useMemo, useRef } from "react";

const SCAN_IDLE_MS = 180;
const REQUEST_ID_PATTERN = /REQ-\d+/i;

const normalizeScannedRequestId = (value) => {
  const matched = String(value || "").trim().match(REQUEST_ID_PATTERN);
  return matched ? matched[0].toUpperCase() : "";
};

const isEditableElement = (element) => {
  if (!element) return false;
  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.isContentEditable
  );
};

const buildCompletionConfirmMessage = (request) => {
  const borrowedCardCount = request.targets.filter(
    (target) => target.reserveInfo?.cardNo && target.isCardBorrowed,
  ).length;
  const incompleteTargetCount = request.targets.filter(
    (target) => !target.isPowerOff,
  ).length;
  const warningLine =
    incompleteTargetCount > 0 ? `\n送電済み設備: ${incompleteTargetCount} 面` : "";

  return [
    `依頼番号 ${request.id} を作業完了・札返却しますか？`,
    "",
    `作業者: ${request.workerName || "未入力"}`,
    `作業内容: ${request.workContent || "作業内容未入力"}`,
    `対象設備: ${request.targets.length} 面`,
    `貸出中の札: ${borrowedCardCount} 枚${warningLine}`,
  ].join("\n");
};

export function useRequestBarcodeScanner({
  activeRequestViews = [],
  historyRequestViews = [],
  onCompleteRequest,
}) {
  const scanBufferRef = useRef("");
  const scanTimerRef = useRef(null);

  const activeRequestById = useMemo(() => {
    return new Map(activeRequestViews.map((req) => [req.id, req]));
  }, [activeRequestViews]);

  const historyRequestIds = useMemo(() => {
    return new Set(historyRequestViews.map((req) => req.id));
  }, [historyRequestViews]);

  const handleScannedRequestId = useCallback(
    (rawValue) => {
      const scannedRequestId = normalizeScannedRequestId(rawValue);
      if (!scannedRequestId) return;

      const request = activeRequestById.get(scannedRequestId);
      if (!request) {
        if (historyRequestIds.has(scannedRequestId)) {
          alert(`依頼番号 ${scannedRequestId} はすでに完了済みです。`);
          return;
        }
        alert(`進行中の依頼番号 ${scannedRequestId} が見つかりません。`);
        return;
      }

      const confirmed = window.confirm(buildCompletionConfirmMessage(request));
      if (confirmed) {
        onCompleteRequest?.(request.id);
      }
    },
    [activeRequestById, historyRequestIds, onCompleteRequest],
  );

  useEffect(() => {
    const clearScanTimer = () => {
      if (scanTimerRef.current) {
        window.clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };

    const flushScanBuffer = () => {
      const bufferedValue = scanBufferRef.current;
      scanBufferRef.current = "";
      clearScanTimer();
      handleScannedRequestId(bufferedValue);
    };

    const scheduleScanFlush = () => {
      clearScanTimer();
      scanTimerRef.current = window.setTimeout(flushScanBuffer, SCAN_IDLE_MS);
    };

    const handleGlobalKeyDown = (event) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isEditableElement(document.activeElement)
      ) {
        return;
      }

      if (event.key === "Enter") {
        if (scanBufferRef.current) {
          event.preventDefault();
          flushScanBuffer();
        }
        return;
      }

      if (event.key.length !== 1) return;

      scanBufferRef.current += event.key;
      scheduleScanFlush();
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      clearScanTimer();
    };
  }, [handleScannedRequestId]);
}
