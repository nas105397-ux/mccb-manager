// 依頼一覧からの再印刷処理と、印刷方式ごとのステータスメッセージを管理する。
import { useEffect, useState } from "react";
import { REQUEST_PRINT_MODES } from "../shared/printSettings";
import {
  createStatusMessage,
  STATUS_MESSAGE_KEYS,
} from "../shared/statusMessages";

const BROWSER_PRINT_DELAY_MS = 50;

export function useRequestListPrintController({
  requestPrintMode,
  mccbList,
  onStatusMessage,
}) {
  const [printRequest, setPrintRequest] = useState(null);
  const [starPrintRequestId, setStarPrintRequestId] = useState(null);
  const isPrintDisabledBySetting = requestPrintMode === REQUEST_PRINT_MODES.NONE;

  useEffect(() => {
    if (!printRequest) return undefined;

    const clearPrintRequest = () => setPrintRequest(null);
    window.addEventListener("afterprint", clearPrintRequest);
    const timerId = window.setTimeout(() => {
      window.print();
    }, BROWSER_PRINT_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("afterprint", clearPrintRequest);
    };
  }, [printRequest]);

  const handlePrintRequest = async (request) => {
    if (isPrintDisabledBySetting) {
      alert("管理者設定で依頼表の印刷は無効になっています。");
      return;
    }

    if (requestPrintMode === REQUEST_PRINT_MODES.BROWSER) {
      setPrintRequest(request);
      return;
    }

    if (starPrintRequestId) return;

    setStarPrintRequestId(request.id);
    try {
      const { printRequestReceipt } = await import("../shared/starReceiptPrinter");
      await printRequestReceipt(request, mccbList);
      onStatusMessage?.(
        createStatusMessage(STATUS_MESSAGE_KEYS.REQUEST_LIST_RECEIPT_SENT),
      );
    } catch (error) {
      console.error(error);
      alert(
        `レシート印刷に失敗しました。プリンター接続とブラウザのWebUSB許可を確認してください。\n${error?.message || error}`,
      );
    } finally {
      setStarPrintRequestId(null);
    }
  };

  return {
    printRequest,
    starPrintRequestId,
    isPrintDisabledBySetting,
    handlePrintRequest,
  };
}
