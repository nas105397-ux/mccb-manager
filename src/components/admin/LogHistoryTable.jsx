import { getLogBadgeClass, UI_STYLES } from "./adminStyles";

// システム操作ログの一覧表示、保持件数設定、全クリア、ページ送り。
export default function LogHistoryTable({
  logs,
  logPageInfo,
  logSettings,
  onChangeMaxLogSize,
  onClearAllLogs,
  onChangeLogPage,
}) {
  return (
    <div className="lg:col-span-2 rounded-xl border border-gray-200 p-4 bg-white space-y-3">
      <h3 className={UI_STYLES.labelSubsection}>
        システム操作ログ履歴 (直近の操作から順に表示)
      </h3>

      <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm">
          <span className="text-gray-500 font-black">最大保持件数:</span>
          <select
            value={logSettings.maxSize}
            onChange={(e) => onChangeMaxLogSize(Number(e.target.value))}
            className={UI_STYLES.selectMaxSize}
          >
            <option value="100">100 件</option>
            <option value="300">300 件</option>
            <option value="500">500 件</option>
            <option value="1000">1000 件</option>
          </select>
        </div>
        <button onClick={onClearAllLogs} className={UI_STYLES.btnClearAction}>
          🗑️ ログ履歴クリア
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="max-h-52 overflow-y-auto font-mono text-xs">
          {!logs || logs.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-gray-50 italic">
              現在、記録されている履歴はありません。
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-500 sticky top-0 border-b border-gray-200 text-[10px]">
                  <th className="p-2 w-36 whitespace-nowrap">操作日時</th>
                  <th className="p-2 w-24 whitespace-nowrap">分類</th>
                  <th className="p-2">操作記録・詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50/70 text-gray-600 transition-all"
                  >
                    <td className="p-2 text-gray-400 whitespace-nowrap text-[11px]">
                      {log.timestamp}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getLogBadgeClass(log.type)}`}
                      >
                        {log.type}
                      </span>
                    </td>
                    <td className="p-2 text-gray-800 font-sans leading-relaxed break-all">
                      {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="bg-gray-50 px-3 py-1.5 text-[10px] text-gray-400 border-t border-gray-150 flex flex-wrap items-center justify-between gap-2">
          <div>
            表示:{" "}
            <span className="font-bold text-gray-600">
              {logs ? logs.length : 0}
            </span>{" "}
            件 / 総数{" "}
            <span className="font-bold text-gray-600">
              {logPageInfo.total || 0}
            </span>{" "}
            件 / 保持上限 {logSettings.maxSize} 件
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChangeLogPage(logPageInfo.page - 1)}
              disabled={logPageInfo.page <= 1}
              className="px-2 py-0.5 rounded border bg-white text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              前へ
            </button>
            <span className="font-bold text-gray-600">
              {logPageInfo.page || 1} / {logPageInfo.totalPages || 1}
            </span>
            <button
              type="button"
              onClick={() => onChangeLogPage(logPageInfo.page + 1)}
              disabled={logPageInfo.page >= logPageInfo.totalPages}
              className="px-2 py-0.5 rounded border bg-white text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              次へ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
