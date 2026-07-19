import { UI_STYLES } from "./adminStyles";

// 設備の個別新規登録フォームと、CSVでの一括入出力をまとめたセクション。
export default function EquipmentRegistrationSection({
  rooms,
  categories,
  room,
  setRoom,
  category,
  setCategory,
  name,
  setName,
  handleSubmit,
  csvInputRef,
  handleCSVButtonClick,
  onImportCSV,
  handleExportCSV,
}) {
  return (
    <div className={UI_STYLES.sectionContainer}>
      <h2 className={UI_STYLES.sectionTitle}>➕ 設備の新規登録</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 📥 設備の個別新規登録 */}
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

        {/* 📁 CSVデータの入出力エリア */}
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
            <button onClick={handleExportCSV} className={UI_STYLES.btnCsvAction}>
              📥 現在のデータをCSVエクスポート
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
