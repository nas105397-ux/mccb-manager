import { useState } from "react";
import { useAdminPanelController } from "../hooks/useAdminPanelController";
import {
  CATEGORY_COLOR_PRESETS,
  getCategoryBadgeClass,
  getCategoryColorKey,
} from "../shared/categoryColorUtils";
import {
  REQUEST_PRINT_MODE_OPTIONS,
  normalizeRequestPrintMode,
} from "../shared/printSettings";

// ==========================================
// 1. コンポーネント外の定数・スタイル定義 (純粋データ)
// ==========================================

// ---- 統一されたUIスタイル定数 ----
// ボタンスタイル
const UI_STYLES = {
  // ボタン
  btnPrimary:
    "bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded text-sm shadow-sm transition-all whitespace-nowrap cursor-pointer",
  btnSecondary:
    "bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer shrink-0",
  btnCsvAction:
    "bg-gray-600 hover:bg-gray-700 text-white font-bold px-4 py-2 rounded text-sm shadow-sm transition-all flex items-center gap-1.5 cursor-pointer",
  btnClearAction:
    "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap",
  btnDangerSmall:
    "text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded font-bold cursor-pointer",
  btnTextSmall:
    "text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded font-bold cursor-pointer",

  // 入力フォーム
  input:
    "border p-2 rounded text-sm w-full bg-white focus:outline-none focus:ring-1 focus:ring-blue-400",
  inputSmall:
    "border p-1.5 rounded text-xs flex-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400",
  select:
    "border p-2 rounded text-sm w-full bg-white focus:outline-none focus:ring-1 focus:ring-blue-400",
  selectMaxSize:
    "bg-transparent text-gray-700 font-black focus:outline-none cursor-pointer",

  // セクション
  sectionContainer: "pt-5 border-t border-gray-150",
  sectionTitle:
    "text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5 border-b pb-1.5",
  subsectionContainer:
    "bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3",

  // リスト
  listContainer:
    "max-h-40 overflow-y-auto border border-gray-200 bg-white rounded-lg p-2 space-y-2",
  listContainerTall:
    "max-h-56 overflow-y-auto border border-gray-200 bg-white rounded-lg p-2 space-y-2",
  listItem:
    "flex items-center justify-between text-xs p-1.5 bg-gray-50 rounded border border-gray-100 mb-px",
  listItemText: "font-semibold text-gray-800",

  // ラベル
  label: "block text-xs text-gray-500 mb-1",
  labelSubsection: "text-xs font-bold text-gray-600",

  // フォーム行
  formRow: "flex gap-1.5",
};

const getLogBadgeClass = (type) => {
  switch (type) {
    case "操作":
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "札貸出":
      return "bg-amber-100 text-amber-800 border border-amber-200";
    case "マスタ登録":
      return "bg-green-100 text-green-800 border border-green-200";
    case "マスタ編集":
      return "bg-purple-100 text-purple-800 border border-purple-200";
    case "マスタ削除":
      return "bg-red-100 text-red-800 border border-red-200";
    case "システム":
      return "bg-gray-100 text-gray-700 border border-gray-300";
    default:
      return "bg-gray-100 text-gray-700 border border-gray-200";
  }
};

const formatBackupDate = (createdAt) => {
  if (!createdAt) return "日時不明";
  return new Date(createdAt).toLocaleString("ja-JP");
};

const formatBackupSize = (size) => {
  const bytes = Number(size || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// ==========================================
// 2. メインコンポーネント
// ==========================================
export default function AdminPanel({
  onImportCSV,
  onSaveEntry,
  mccbList = [],
  rooms = [],
  categories = [],
  categoryColors = {},
  addRoom,
  updateRoom,
  deleteRoom,
  addCategory,
  updateCategory,
  deleteCategory,
  updateCategoryColor = () => {},
  logs = [],
  logPageInfo = { page: 1, pageSize: 50, total: 0, totalPages: 1 },
  logSettings = { maxSize: 500 },
  onChangeMaxLogSize,
  onClearAllLogs,
  onChangeLogPage = () => {},
  deviceGroups = [],
  addDeviceGroup = () => {},
  updateDeviceGroup = () => {},
  deleteDeviceGroup = () => {},
  historySettings = { maxSize: 500 },
  onClearRequestHistory = () => {},
  onChangeMaxHistorySize = () => {},
  databaseBackups = [],
  onCreateDatabaseBackup = () => {},
  onRestoreDatabaseBackup = () => {},
  requestPrintMode,
  onChangeRequestPrintMode = () => {},
}) {
  const [selectedBackupFile, setSelectedBackupFile] = useState("");
  const {
    room,
    setRoom,
    category,
    setCategory,
    name,
    setName,
    newRoomInput,
    setNewRoomInput,
    newCategoryInput,
    setNewCategoryInput,
    newGroupName,
    setNewGroupName,
    selectedGroupId,
    setSelectedGroupId,
    currentGroup,
    starPrinterConnection,
    starPrinterConnectionStatus,
    isConnectingStarPrinter,
    isTestingStarPrinter,
    csvInputRef,
    handleSubmit,
    handleExportCSV,
    handleCSVButtonClick,
    handleEditRoomPrompt,
    handleEditCategoryPrompt,
    handleAddRoom,
    handleAddCategory,
    handleCreateGroup,
    handleDeleteGroup,
    handleEditGroupPrompt,
    handleToggleDeviceInGroup,
    handleConnectStarPrinter,
    handleClearStarPrinterConnection,
    handlePrintStarPrinterTestPage,
  } = useAdminPanelController({
    onSaveEntry,
    mccbList,
    rooms,
    categories,
    addRoom,
    updateRoom,
    addCategory,
    updateCategory,
    deviceGroups,
    addDeviceGroup,
    updateDeviceGroup,
    deleteDeviceGroup,
  });
  const currentRequestPrintMode = normalizeRequestPrintMode(requestPrintMode);
  const selectedBackupFileName = databaseBackups.some(
    (backup) => backup.fileName === selectedBackupFile,
  )
    ? selectedBackupFile
    : databaseBackups[0]?.fileName || "";

  // --- 画面レンダリング ---
  return (
    <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm space-y-6">
      <div className={UI_STYLES.sectionContainer}>
        <h2 className={UI_STYLES.sectionTitle}>➕ 設備の新規登録</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 📥 SECTION 1: 設備の個別新規登録 */}
          <div className="rounded-xl border border-gray-200 p-4 bg-white">
            <h3 className={UI_STYLES.labelSubsection}>設備の個別新規登録</h3>
            <form
              onSubmit={handleSubmit}
              className="flex flex-wrap items-end gap-3"
            >
              <div className="w-48">
                <label className={UI_STYLES.label}>電気室</label>
                <select
                  value={room || rooms[0] || ""}
                  onChange={(e) => setRoom(e.target.value)}
                  className={UI_STYLES.select}
                >
                  {rooms.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-32">
                <label className={UI_STYLES.label}>区分</label>
                <select
                  value={category || categories[0] || ""}
                  onChange={(e) => setCategory(e.target.value)}
                  className={UI_STYLES.select}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className={UI_STYLES.label}>設備名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: ○○ポンプ用ブレーカー"
                  className={UI_STYLES.input}
                />
              </div>

              <button type="submit" className={UI_STYLES.btnPrimary}>
                新規追加
              </button>
            </form>
          </div>

          {/* 📁 SECTION 2: CSVデータの入出力エリア */}
          <div className="rounded-xl border border-gray-200 p-4 bg-white">
            <h3 className={UI_STYLES.labelSubsection}>CSVデータ入出力</h3>
            <p className="text-xs text-gray-500 mb-3">
              CSVで設備データを一括で取り込み・出力できます。
            </p>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={handleCSVButtonClick}
                className={UI_STYLES.btnCsvAction}
              >
                📤 CSVファイルから取り込み（データ上書き）
              </button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                onChange={(e) =>
                  e.target.files?.[0] && onImportCSV(e.target.files[0])
                }
                className="hidden"
              />
              <button
                onClick={handleExportCSV}
                className={UI_STYLES.btnCsvAction}
              >
                📥 現在のデータをCSVエクスポート
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ⚙️ SECTION 3: 電気室・区分マスター管理エリア */}
      <div className={UI_STYLES.sectionContainer}>
        <h2 className={UI_STYLES.sectionTitle}>
          ⚙️ 電気室・区分マスター設定の追加・編集
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 電気室一覧リスト */}
          <div className={UI_STYLES.subsectionContainer}>
            <h3 className={UI_STYLES.labelSubsection}>
              🏢 電気室マスター一覧 ({rooms.length})
            </h3>
            <div className={UI_STYLES.listContainer}>
              {rooms.map((r) => (
                <div key={r} className={UI_STYLES.listItem}>
                  <span className={UI_STYLES.listItemText}>{r}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditRoomPrompt(r)}
                      className={UI_STYLES.btnTextSmall}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => deleteRoom(r)}
                      className={UI_STYLES.btnDangerSmall}
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className={UI_STYLES.formRow}>
              <input
                type="text"
                value={newRoomInput}
                onChange={(e) => setNewRoomInput(e.target.value)}
                placeholder="新しい電気室名"
                className={UI_STYLES.inputSmall}
              />
              <button
                onClick={handleAddRoom}
                className={UI_STYLES.btnSecondary}
              >
                ＋ 追加
              </button>
            </div>
          </div>

          {/* 区分一覧リスト */}
          <div className={UI_STYLES.subsectionContainer}>
            <h3 className={UI_STYLES.labelSubsection}>
              🏷️ 区分マスター一覧 ({categories.length})
            </h3>
            <div className={UI_STYLES.listContainer}>
              {categories.map((c) => (
                <div
                  key={c}
                  className={`${UI_STYLES.listItem} gap-2 flex-wrap`}
                >
                  <span
                    className={`text-[11px] border px-2 py-0.5 rounded font-black ${getCategoryBadgeClass(c, categoryColors)}`}
                  >
                    {c}
                  </span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span
                      className={`h-5 w-5 rounded-full border shadow-inner ${CATEGORY_COLOR_PRESETS[getCategoryColorKey(c, categoryColors)].swatchClass}`}
                      aria-hidden="true"
                    />
                    <select
                      value={getCategoryColorKey(c, categoryColors)}
                      onChange={(e) => updateCategoryColor(c, e.target.value)}
                      className="border border-gray-200 rounded bg-white px-1.5 py-0.5 text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      aria-label={`${c} の表示色`}
                    >
                      {Object.entries(CATEGORY_COLOR_PRESETS).map(
                        ([key, preset]) => (
                          <option key={key} value={key}>
                            {preset.label}
                          </option>
                        ),
                      )}
                    </select>
                    <button
                      onClick={() => handleEditCategoryPrompt(c)}
                      className={UI_STYLES.btnTextSmall}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => deleteCategory(c)}
                      className={UI_STYLES.btnDangerSmall}
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className={UI_STYLES.formRow}>
              <input
                type="text"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                placeholder="新しい区分名 (例: 7スト)"
                className={UI_STYLES.inputSmall}
              />
              <button
                onClick={handleAddCategory}
                className={UI_STYLES.btnSecondary}
              >
                ＋ 追加
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 👥 SECTION 4: 設備グループ一括選択マスター管理エリア */}
      <div className={UI_STYLES.sectionContainer}>
        <h2 className={UI_STYLES.sectionTitle}>
          👥 設備グループ一括選択マスター設定
        </h2>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 左側：グループ一覧 */}
          <div className="w-full lg:w-1/3 space-y-4">
            <div className={UI_STYLES.subsectionContainer}>
              <h3 className={UI_STYLES.labelSubsection}>
                📁 グループ一覧 ({deviceGroups.length})
              </h3>
              <div className={UI_STYLES.listContainerTall}>
                {deviceGroups.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-4">
                    グループがありません
                  </div>
                ) : (
                  deviceGroups.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => setSelectedGroupId(g.id)}
                      className={`flex items-center justify-between text-xs p-2 rounded border cursor-pointer transition-all ${selectedGroupId === g.id ? "bg-blue-50 border-blue-400 text-blue-800 shadow-sm" : "bg-white border-gray-100 text-gray-700 hover:bg-gray-50"} mb-px`}
                    >
                      <span className="font-semibold truncate">
                        {g.name} ({g.mccbIds?.length || 0})
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={(e) => handleEditGroupPrompt(g, e)}
                          className={UI_STYLES.btnTextSmall}
                        >
                          編集
                        </button>
                        <button
                          onClick={(e) => handleDeleteGroup(g, e)}
                          className={UI_STYLES.btnDangerSmall}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className={UI_STYLES.formRow}>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="新しいグループ名 (例: A系統一括)"
                  className={UI_STYLES.inputSmall}
                />
                <button
                  onClick={handleCreateGroup}
                  className={UI_STYLES.btnPrimary}
                  style={{
                    padding: "0.375rem 0.75rem",
                    fontSize: "0.75rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  作成
                </button>
              </div>
            </div>
          </div>

          {/* 右側：所属設備編集 */}
          <div className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col min-h-[300px]">
            {currentGroup ? (
              <>
                <h3 className="text-xs font-bold text-gray-600 mb-3 flex justify-between items-center border-b border-gray-200 pb-2">
                  <span>
                    📦 所属設備の紐付け:{" "}
                    <span className="text-blue-700 ml-1">
                      {currentGroup.name}
                    </span>
                  </span>
                  <span>選択中: {currentGroup.mccbIds?.length || 0} 面</span>
                </h3>
                <div className="flex-1 overflow-y-auto max-h-[350px] bg-white border border-gray-200 rounded-lg p-2 grid grid-cols-1 md:grid-cols-2 gap-x-2 gap-y-2 content-start">
                  {mccbList.map((mccb) => {
                    const isChecked = currentGroup.mccbIds?.includes(mccb.id);
                    const badgeColor = getCategoryBadgeClass(
                      mccb.category,
                      categoryColors,
                    );
                    return (
                      <label
                        key={mccb.id}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs font-bold transition-all ${
                          isChecked
                            ? "border-blue-300 bg-blue-50/30 text-blue-900 shadow-sm"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleDeviceInGroup(mccb.id)}
                          className="rounded text-blue-600"
                        />
                        <div className="truncate flex-1">
                          <span
                            className={`text-[11px] border px-1 py-0.5 rounded mr-1 ${badgeColor}`}
                          >
                            {mccb.category}
                          </span>
                          {mccb.name}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-400 font-bold border-2 border-dashed border-gray-200 rounded-lg bg-white">
                👈
                左側の一覧からグループを選択すると、ここに所属設備の紐付け編集パネルが表示されます
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={UI_STYLES.sectionContainer}>
        <h2 className={UI_STYLES.sectionTitle}>📜 ログの管理</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ⚙️ SECTION 5: 停電作業依頼 履歴管理設定エリア */}
          <div className="rounded-xl border border-gray-200 p-4 bg-white">
            <h3 className={UI_STYLES.labelSubsection}>
              停電作業依頼 履歴管理設定
            </h3>
            <div className="space-y-4 text-xs font-bold">
              <div className="text-gray-500 font-medium">
                完了した依頼の履歴件数を設定し、必要時に履歴を全削除できます。
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                  <span className="text-gray-500 font-black">
                    最大保持件数:
                  </span>
                  <select
                    value={historySettings?.maxSize || 500}
                    onChange={(e) =>
                      onChangeMaxHistorySize(Number(e.target.value))
                    }
                    className={UI_STYLES.selectMaxSize}
                  >
                    <option value="50">50 件</option>
                    <option value="100">100 件</option>
                    <option value="300">300 件</option>
                    <option value="500">500 件</option>
                  </select>
                </div>
                <button
                  onClick={onClearRequestHistory}
                  className={UI_STYLES.btnClearAction}
                >
                  🗑️ 依頼履歴全クリア
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 bg-white">
            <h3 className={UI_STYLES.labelSubsection}>
              依頼表 印刷方式
            </h3>
            <div className="mt-3 space-y-2">
              {REQUEST_PRINT_MODE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-xs cursor-pointer transition-all ${
                    currentRequestPrintMode === option.value
                      ? "border-blue-300 bg-blue-50/60 text-blue-900"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="requestPrintMode"
                    value={option.value}
                    checked={currentRequestPrintMode === option.value}
                    onChange={() => onChangeRequestPrintMode(option.value)}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <span className="block font-black">{option.label}</span>
                    <span className="mt-1 block leading-relaxed text-gray-500">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-[11px] font-bold text-gray-400">
              この設定は使用中のブラウザに保存されます。端末ごとに印刷方式を切り替えできます。
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 bg-white">
            <h3 className={UI_STYLES.labelSubsection}>
              DBバックアップ・復旧
            </h3>
            <div className="space-y-4 text-xs font-bold">
              <div className="text-gray-500 font-medium">
                現在のSQLite DBを data/backups に保存します。最新10件を保持します。復旧前にも現在DBを自動バックアップします。
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onCreateDatabaseBackup}
                  className={UI_STYLES.btnCsvAction}
                >
                  💾 DBバックアップ作成
                </button>
              </div>
              <div className="space-y-2 rounded-lg border border-red-100 bg-red-50/40 p-3">
                <label className="block text-[11px] font-black text-red-700">
                  復旧するバックアップ
                </label>
                <select
                  value={selectedBackupFileName}
                  onChange={(e) => setSelectedBackupFile(e.target.value)}
                  disabled={databaseBackups.length === 0}
                  className={`${UI_STYLES.select} disabled:bg-gray-100 disabled:text-gray-400`}
                >
                  {databaseBackups.length === 0 ? (
                    <option value="">バックアップがありません</option>
                  ) : (
                    databaseBackups.map((backup) => (
                      <option key={backup.fileName} value={backup.fileName}>
                        {backup.fileName} / {formatBackupDate(backup.createdAt)} / {formatBackupSize(backup.size)}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => onRestoreDatabaseBackup(selectedBackupFileName)}
                  disabled={!selectedBackupFileName}
                  className={`${UI_STYLES.btnClearAction} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  ♻️ 選択バックアップからDB復旧
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 bg-white">
            <h3 className={UI_STYLES.labelSubsection}>
              スター精密プリンター接続
            </h3>
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
                  className={`${UI_STYLES.btnCsvAction} disabled:opacity-60 disabled:cursor-wait`}
                >
                  {isConnectingStarPrinter
                    ? "🔌 接続中..."
                    : "🔌 プリンター接続"}
                </button>
                <button
                  type="button"
                  onClick={handleClearStarPrinterConnection}
                  disabled={!starPrinterConnection || isConnectingStarPrinter || isTestingStarPrinter}
                  className={`${UI_STYLES.btnClearAction} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  接続情報クリア
                </button>
                <button
                  type="button"
                  onClick={handlePrintStarPrinterTestPage}
                  disabled={!starPrinterConnection || isConnectingStarPrinter || isTestingStarPrinter}
                  className={`${UI_STYLES.btnCsvAction} disabled:opacity-60 disabled:cursor-wait`}
                >
                  {isTestingStarPrinter
                    ? "🖨️ テスト印刷中..."
                    : "🖨️ テスト印刷"}
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

          {/* 📜 SECTION 6: システム操作ログ履歴セクション */}
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
              <button
                onClick={onClearAllLogs}
                className={UI_STYLES.btnClearAction}
              >
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
        </div>
      </div>
    </div>
  );
}
