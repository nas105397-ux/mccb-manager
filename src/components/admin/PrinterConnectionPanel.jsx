import { UI_STYLES } from "./adminStyles";

// スター精密プリンターのUSB接続情報の保存・クリアと、テスト印刷。
export default function PrinterConnectionPanel({
  starPrinterConnection,
  starPrinterConnectionStatus,
  isConnectingStarPrinter,
  isTestingStarPrinter,
  handleConnectStarPrinter,
  handleClearStarPrinterConnection,
  handlePrintStarPrinterTestPage,
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <h3 className={UI_STYLES.labelSubsection}>スター精密プリンター接続</h3>
      <div className="mt-3 space-y-3 text-xs font-bold">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-600">
          {starPrinterConnection ? (
            <div className="space-y-1">
              <div>
                接続先:{" "}
                <span className="text-gray-900">
                  {starPrinterConnection.model || "モデル未取得"}
                </span>
              </div>
              <div className="break-all text-[11px] text-gray-500">
                identifier: {starPrinterConnection.identifier}
              </div>
              {starPrinterConnection.connectedAt && (
                <div className="text-[11px] text-gray-400">
                  保存日時:{" "}
                  {new Date(starPrinterConnection.connectedAt).toLocaleString(
                    "ja-JP",
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-400">
              保存済みのプリンター接続情報はありません。
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleConnectStarPrinter}
            disabled={isConnectingStarPrinter}
            className={`${UI_STYLES.btnCsvAction} ${UI_STYLES.btnDisabledBusy}`}
          >
            {isConnectingStarPrinter ? "🔌 接続中..." : "🔌 プリンター接続"}
          </button>
          <button
            type="button"
            onClick={handleClearStarPrinterConnection}
            disabled={
              !starPrinterConnection ||
              isConnectingStarPrinter ||
              isTestingStarPrinter
            }
            className={`${UI_STYLES.btnClearAction} ${UI_STYLES.btnDisabledBlocked}`}
          >
            接続情報クリア
          </button>
          <button
            type="button"
            onClick={handlePrintStarPrinterTestPage}
            disabled={
              !starPrinterConnection ||
              isConnectingStarPrinter ||
              isTestingStarPrinter
            }
            className={`${UI_STYLES.btnCsvAction} ${UI_STYLES.btnDisabledBusy}`}
          >
            {isTestingStarPrinter ? "🖨️ テスト印刷中..." : "🖨️ テスト印刷"}
          </button>
        </div>
        {starPrinterConnectionStatus && (
          <p className="text-[11px] text-gray-500">
            {starPrinterConnectionStatus}
          </p>
        )}
        <p className="text-[11px] font-bold text-gray-400">
          WebUSB対応ブラウザでUSBプリンターを選択すると、この端末に接続情報を保存します。
        </p>
      </div>
    </div>
  );
}
