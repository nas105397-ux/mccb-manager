// 電気室モニター用の全画面ビュー。停電中設備と直近ログを監視表示する。
import { useEffect, useState } from "react";
import { useDashboardController, POLL_INTERVAL } from "../hooks/useDashboardController";
import VirtualizedOffMccbGrid from "./VirtualizedOffMccbGrid";

// ==========================================
// 定数定義
// ==========================================

/** テーマ別スタイル（ダーク） */
const DARK_STYLES = {
  root:               "bg-gray-950 text-gray-100",
  headerBorder:       "border-gray-800",
  leftPanel:          "bg-gray-900/60 border-gray-850",
  sidePanel:          "bg-gray-900 border-gray-800",
  summaryPanel:       "bg-gray-850 border-gray-800",
  clockContainer:     "bg-gray-900 border-gray-700",
  clockTime:          "text-teal-400",
  titleText:          "text-teal-300",
  subtleText:         "text-gray-400",
  closeButton:        "bg-red-950/40 border-red-900 text-red-400 hover:bg-red-900/60",
  themeToggleButton:  "bg-gray-900 border-gray-700 text-amber-400 hover:bg-gray-800",
  colLayoutWrap:      "bg-gray-900 border-gray-700",
  dangerTitle:        "text-red-400",
  dangerBadge:        "bg-red-950 text-red-400 border-red-900",
  emptyStateContainer: "text-gray-500 border-gray-800 bg-gray-900/30",
  emptyStateTitle:    "text-gray-400",
  emptyStateSubtitle: "text-gray-600",
  amberAccent:        "text-amber-400",
  logHeader:          "text-gray-400 border-gray-800",
  logItemContainer:   "bg-gray-850 border-gray-700",
};

/** テーマ別スタイル（ライト） */
const LIGHT_STYLES = {
  root:               "bg-gray-100 text-gray-800",
  headerBorder:       "border-gray-300",
  leftPanel:          "bg-white border-gray-200",
  sidePanel:          "bg-white border-gray-200",
  summaryPanel:       "bg-gray-50 border-gray-200",
  clockContainer:     "bg-white border-gray-200",
  clockTime:          "text-blue-600",
  titleText:          "text-blue-900",
  subtleText:         "text-gray-500",
  closeButton:        "bg-white border-red-200 text-red-600 hover:bg-red-50",
  themeToggleButton:  "bg-white border-gray-300 text-blue-950 hover:bg-gray-50",
  colLayoutWrap:      "bg-white border-gray-300",
  dangerTitle:        "text-red-600",
  dangerBadge:        "bg-red-50 text-red-600 border-red-200",
  emptyStateContainer: "text-gray-400 border-gray-300 bg-gray-50",
  emptyStateTitle:    "text-gray-600",
  emptyStateSubtitle: "text-gray-400",
  amberAccent:        "text-amber-600",
  logHeader:          "text-gray-600 border-gray-200",
  logItemContainer:   "bg-gray-50 border-gray-300",
};

// ==========================================
// スタイルヘルパー
// ==========================================

const getThemeStyle = (isDarkMode, key) => (isDarkMode ? DARK_STYLES : LIGHT_STYLES)[key] ?? "";

// テーマ以外の状態（アクティブ/未読区分など）と掛け合わせる箇所だけに使う軽量ヘルパー。
const pick = (isDarkMode, dark, light) => (isDarkMode ? dark : light);

/** ログメッセージを「見出し行 + 詳細行」で表示できる形に整形 */
const formatActivityMessage = (message) => {
  if (!message) return "";
  if (message.includes("\n")) return message;

  const matched = message.match(/^(【[^】]+】)(.+)$/);
  if (!matched) return message;

  return `${matched[1]}\n${matched[2].trim()}`;
};

function CurrentTimeClock({ isDarkMode }) {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      setTimeStr(new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const clockTimer = setInterval(updateTime, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  return (
    <div className={`border px-6 py-2 rounded-xl text-right shrink-0 w-[220px] h-[76px] box-border flex flex-col justify-center ${
      getThemeStyle(isDarkMode, "clockContainer")
    }`}>
      <span className="text-xs text-gray-500 font-bold block tracking-wider">CURRENT TIME</span>
      <span className={`font-mono text-3xl font-black tracking-wider tabular-nums ${
        getThemeStyle(isDarkMode, "clockTime")
      }`}>
        {timeStr}
      </span>
    </div>
  );
}

// ==========================================
// 2. メインコンポーネント
// ==========================================
export default function DashboardView({ onClose }) {
  const {
    loading,
    isDarkMode,
    setIsDarkMode,
    colLayout,
    setColLayout,
    processedOffMccbs,
    stats,
    recentLogs,
    categoryColors,
  } = useDashboardController();

  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalRootOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalRootOverflow;
    };
  }, []);

  // --- ローディング画面 ---
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-950 text-white flex items-center justify-center font-black tracking-widest text-3xl">
        📡 電気室 監視システム 同期中...
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 p-5 font-sans flex flex-col overflow-hidden box-border select-none m-0 ${
      getThemeStyle(isDarkMode, "root")
    }`}>

      {/* 🔝 1. ヘッダーエリア */}
      <div className={`flex justify-between items-center border-b-2 pb-3 mb-4 shrink-0 ${
        getThemeStyle(isDarkMode, "headerBorder")
      }`}>
        <div>
          <h1 className={`text-3xl lg:text-4xl font-black tracking-widest ${
            getThemeStyle(isDarkMode, "titleText")
          }`}>
            🔖 禁止札管理ダッシュボード
          </h1>
          <p className={`text-sm mt-0.5 ${getThemeStyle(isDarkMode, "subtleText")}`}>
            ※本画面は {POLL_INTERVAL / 1000}秒 間隔で自動同期されています
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* 監視モード終了ボタン */}
            {onClose && (
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-xl text-xs font-black border cursor-pointer h-9 ${
                  getThemeStyle(isDarkMode, "closeButton")
                }`}
              >
                ↩️ モニター終了
              </button>
            )}

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`px-4 py-2 rounded-xl text-xs font-black border cursor-pointer flex items-center gap-1.5 shrink-0 h-9 ${
                getThemeStyle(isDarkMode, "themeToggleButton")
              }`}
            >
              {isDarkMode ? "☀️ ライトモード" : "🌙 ダークモード"}
            </button>

            {/* 表示列数コントローラースイッチ */}
            <div className={`flex items-center gap-1 border rounded-xl p-1 shrink-0 h-9 ${
              getThemeStyle(isDarkMode, "colLayoutWrap")
            }`}>
              <span className="text-[10px] font-black px-2 text-gray-500 tracking-tighter uppercase">📑 表示列数:</span>
              {["auto", "3", "4", "5"].map((col) => (
                <button
                  key={col}
                  onClick={() => setColLayout(col)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer h-full flex items-center ${
                    colLayout === col
                      ? pick(isDarkMode, "bg-teal-50 text-gray-950", "bg-blue-600 text-white")
                      : pick(isDarkMode, "text-gray-400 hover:text-white hover:bg-gray-800", "text-gray-600 hover:bg-gray-100")
                  }`}
                >
                  {col === "auto" ? "自動" : `${col}列`}
                </button>
              ))}
            </div>
          </div>

          <CurrentTimeClock isDarkMode={isDarkMode} />
        </div>
      </div>

      {/* 🔄 2. メインレイアウト */}
      <div className="flex-1 flex gap-5 min-h-0 overflow-hidden mb-1">

        {/* 🔴 左側：現在操作禁止（停電対応中）設備一覧 */}
        <div className={`flex-1 border rounded-2xl p-5 flex flex-col min-h-0 overflow-hidden ${
          getThemeStyle(isDarkMode, "leftPanel")
        }`}>
          <div className="flex justify-between items-center mb-3 shrink-0">
            <h2 className={`text-2xl font-black flex items-center gap-3 ${getThemeStyle(isDarkMode, "dangerTitle")}`}>
              🔴 停電中設備一覧
            </h2>
            <span className={`text-sm border px-4 py-0.5 rounded-full font-black tracking-wider ${
              getThemeStyle(isDarkMode, "dangerBadge")
            }`}>
              対象: {stats.offCount} 件
            </span>
          </div>

          <div className="flex-1 min-h-0 flex">
            {stats.offCount === 0 ? (
              <div className={`h-full flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl space-y-4 ${
                getThemeStyle(isDarkMode, "emptyStateContainer")
              }`}>
                <span className="text-6xl">🟢</span>
                <p className={`text-2xl font-black tracking-widest ${getThemeStyle(isDarkMode, "emptyStateTitle")}`}>
                  現在、操作禁止（停電）設定中の設備はありません
                </p>
                <p className={`text-sm ${getThemeStyle(isDarkMode, "emptyStateSubtitle")}`}>全系統、通常送電運用中</p>
              </div>
            ) : (
              <VirtualizedOffMccbGrid
                items={processedOffMccbs}
                colLayout={colLayout}
                isDarkMode={isDarkMode}
                categoryColors={categoryColors}
              />
            )}
          </div>
        </div>

        {/* 📊 右側：システムカウンターサマリー ＆ 操作ログ */}
        <div className="w-[380px] flex flex-col gap-4 shrink-0 min-h-0 overflow-hidden">

          {/* サマリーメーター */}
          <div className={`border rounded-2xl p-4 grid grid-cols-2 gap-3 shrink-0 ${
            getThemeStyle(isDarkMode, "sidePanel")
          }`}>
            <div className={`p-3 rounded-xl border text-center ${getThemeStyle(isDarkMode, "summaryPanel")}`}>
              <span className={`text-xs font-black block mb-0.5 ${getThemeStyle(isDarkMode, "subtleText")}`}>🟢 送電中</span>
              <span className="text-3xl font-mono font-black text-green-500 tracking-tight">{stats.onCount}</span>
              <span className="text-[10px] text-gray-500 block mt-0.5">/ 全 {stats.totalCount} 面</span>
            </div>
            <div className={`p-3 rounded-xl border text-center ${getThemeStyle(isDarkMode, "summaryPanel")}`}>
              <span className={`text-xs font-black block mb-0.5 ${getThemeStyle(isDarkMode, "subtleText")}`}>🔴 停電中</span>
              <span className="text-3xl font-mono font-black text-red-500 tracking-tight">{stats.offCount}</span>
              <span className="text-[10px] text-gray-500 block mt-0.5">/ 全 {stats.totalCount} 面</span>
            </div>
            <div className={`p-3 rounded-xl border text-center col-span-2 ${getThemeStyle(isDarkMode, "summaryPanel")}`}>
              <span className={`text-xs font-black block mb-1 tracking-wider ${getThemeStyle(isDarkMode, "subtleText")}`}>
                🔖 発行中の子札総数
              </span>
              <span className={`text-3xl font-mono font-black tracking-tight ${getThemeStyle(isDarkMode, "amberAccent")}`}>
                {stats.totalBorrowedCards} <span className="text-xs font-sans font-black text-gray-400">枚</span>
              </span>
            </div>
          </div>

          {/* 操作ログ履歴タイムライン */}
          <div className={`border rounded-2xl p-4 flex flex-col min-h-0 overflow-hidden ${
            getThemeStyle(isDarkMode, "sidePanel")
          }`}>
            <h2 className={`text-xs font-black mb-2 border-b pb-1.5 flex items-center gap-2 tracking-wider ${
              getThemeStyle(isDarkMode, "logHeader")
            }`}>
              📜 直近のアクティビティ
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[11px] font-mono min-h-0">
              {recentLogs.map((log) => {
                const hasGreen = log.message?.includes("🟢");
                const hasRed = log.message?.includes("🔴");
                const formattedMessage = formatActivityMessage(log.message);
                return (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded border-l-4 ${
                      getThemeStyle(isDarkMode, "logItemContainer")
                    }`}
                  >
                    <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                      <span className="font-bold">[{log.type}]</span>
                      <span>{log.timestamp ? (log.timestamp.split(" ")[1] || log.timestamp) : ""}</span>
                    </div>
                    <p className={`font-black leading-relaxed text-xs whitespace-pre-line ${
                      hasRed
                        ? pick(isDarkMode, "text-red-300", "text-red-700")
                        : hasGreen
                          ? pick(isDarkMode, "text-green-300", "text-green-700")
                          : pick(isDarkMode, "text-gray-300", "text-gray-700")
                    }`}>
                      {formattedMessage}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
