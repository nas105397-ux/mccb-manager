import { useAppController } from "./hooks/useAppController";
import Header from "./components/Header";
import AdminPanel from "./components/AdminPanel";

import ControlModal from "./components/ControlModal";
import RequestFormPanel from "./components/RequestFormPanel";
import RequestListPanel from "./components/RequestListPanel";
import DashboardView from "./components/DashboardView";
import VirtualizedMccbGrid from "./components/VirtualizedMccbGrid";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

function AppContent() {
  // 処理ロジックは useAppController に集約し、ここではUIレンダリングに専念する
  const controller = useAppController();

  // 特殊画面（フル画面モニターモード）の早期リターン
  if (controller.activeTab === "/monitor") {
    return <DashboardView onClose={() => controller.goTo("/")} />;
  }

  // 通常アプリケーション画面のレンダリング
  return (
    <div
      translate="no"
      className="min-h-screen bg-gray-50 text-gray-850 p-4 font-sans print:p-0 print:bg-white"
    >
      <div className="max-w-7xl mx-auto space-y-4 print:space-y-0">
        {/* 上部共通ヘッダー・ナビゲーションバー */}
        <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm print:hidden">
          <div className="flex flex-wrap gap-2">
            {/* 重複していたタブボタンをループ展開に変更しスッキリ整頓 */}
            {controller.navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => controller.goTo(item.path)}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  controller.activeTab === item.path
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </button>
            ))}
            {/* モニターボタンのみ特別目立つカラーリングデザインを維持 */}
            <button
              onClick={() => controller.goTo("/monitor")}
              className="px-4 py-2 rounded-lg text-xs font-black text-teal-600 border border-teal-200 bg-teal-50 hover:bg-teal-100 transition-all cursor-pointer shadow-sm flex items-center gap-1"
            >
              🖥️ 電気室モニター
            </button>
          </div>

          <button
            onClick={controller.handleToggleAdmin}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wide border cursor-pointer shadow-sm transition-all whitespace-nowrap mr-1 ${controller.isAdmin ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100" : "bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100"}`}
          >
            {controller.isAdmin
              ? "🔓 モード: 管理者"
              : "🔒 モード: 一般ユーザー"}
          </button>
        </div>

        {/* ルーティング定義および各機能コンテンツパネル */}
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Header
                  searchTerm={controller.searchTerm}
                  setSearchTerm={controller.setSearchTerm}
                  filterStatus={controller.filterStatus}
                  setFilterStatus={controller.setFilterStatus}
                  filterRoom={controller.filterRoom}
                  setFilterRoom={controller.setFilterRoom}
                  filterFavorite={controller.filterFavorite}
                  setFilterFavorite={controller.setFilterFavorite}
                  totalCount={controller.totalCount}
                  offCount={controller.offCount}
                  onCount={controller.onCount}
                  isAdmin={controller.isAdmin}
                  setIsAdmin={controller.setIsAdmin}
                  rooms={controller.rooms}
                />

                {controller.isAdmin && (
                  <AdminPanel
                    onImportCSV={controller.importFromCSV}
                    onSaveEntry={controller.saveMccbEntry}
                    mccbList={controller.mccbList}
                    rooms={controller.rooms}
                    categories={controller.categories}
                    addRoom={controller.addRoom}
                    updateRoom={controller.updateRoom}
                    deleteRoom={controller.deleteRoom}
                    addCategory={controller.addCategory}
                    updateCategory={controller.updateCategory}
                    deleteCategory={controller.deleteCategory}
                    logs={controller.logs}
                    logSettings={controller.logSettings}
                    onChangeMaxLogSize={controller.changeMaxLogSize}
                    onClearAllLogs={controller.clearAllLogs}
                    deviceGroups={controller.deviceGroups}
                    addDeviceGroup={controller.addDeviceGroup}
                    updateDeviceGroup={controller.updateDeviceGroup}
                    deleteDeviceGroup={controller.deleteDeviceGroup}
                    historySettings={controller.historySettings}
                    onClearRequestHistory={controller.clearRequestHistory}
                    onChangeMaxHistorySize={controller.changeMaxHistorySize}
                  />
                )}

                <div className="mt-4">
                  <VirtualizedMccbGrid
                    items={controller.filteredMccbList}
                    borrowedCountMap={controller.borrowedCountMap}
                    onSelect={controller.handleSelect}
                    onToggleFavorite={controller.handleToggleFavorite}
                    activeMccbIds={controller.activeMccbIds}
                  />
                </div>

                {controller.currentMccb && (
                  <ControlModal
                    key={controller.currentMccb.id}
                    mccb={controller.currentMccb}
                    borrowedCount={
                      controller.borrowedCountMap[controller.currentMccb.id] ??
                      0
                    }
                    onClose={controller.handleCloseModal}
                    onUpdate={controller.updateMccb}
                    onDelete={controller.deleteMccb}
                    isAdmin={controller.isAdmin}
                    rooms={controller.rooms}
                    categories={controller.categories}
                  />
                )}
              </>
            }
          />

          <Route
            path="/request"
            element={
              <RequestFormPanel
                mccbList={controller.mccbList}
                onAddRequest={controller.addRequest}
                requests={controller.requests}
                deviceGroups={controller.deviceGroups}
              />
            }
          />
          <Route
            path="/request-list"
            element={
              <RequestListPanel
                requests={controller.requests}
                requestHistory={controller.requestHistory}
                mccbList={controller.mccbList}
                onDeleteRequest={controller.deleteRequest}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
