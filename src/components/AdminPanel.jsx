// 管理画面。設備マスタ、電気室/区分、ログ、DBバックアップ、印刷設定をまとめて扱う。
import { useState } from "react";
import { useAdminPanelController } from "../hooks/useAdminPanelController";
import { normalizeRequestPrintMode } from "../shared/printSettings";
import { UI_STYLES } from "./admin/adminStyles";
import EquipmentRegistrationSection from "./admin/EquipmentRegistrationSection";
import RoomMasterList from "./admin/RoomMasterList";
import CategoryMasterList from "./admin/CategoryMasterList";
import DeviceGroupSection from "./admin/DeviceGroupSection";
import RequestHistorySettingsPanel from "./admin/RequestHistorySettingsPanel";
import PrintModePanel from "./admin/PrintModePanel";
import DatabaseBackupPanel from "./admin/DatabaseBackupPanel";
import PrinterConnectionPanel from "./admin/PrinterConnectionPanel";
import LogHistoryTable from "./admin/LogHistoryTable";

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
      <EquipmentRegistrationSection
        rooms={rooms}
        categories={categories}
        room={room}
        setRoom={setRoom}
        category={category}
        setCategory={setCategory}
        name={name}
        setName={setName}
        handleSubmit={handleSubmit}
        csvInputRef={csvInputRef}
        handleCSVButtonClick={handleCSVButtonClick}
        onImportCSV={onImportCSV}
        handleExportCSV={handleExportCSV}
      />

      {/* ⚙️ 電気室・区分マスター管理エリア */}
      <div className={UI_STYLES.sectionContainer}>
        <h2 className={UI_STYLES.sectionTitle}>
          ⚙️ 電気室・区分マスター設定の追加・編集
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RoomMasterList
            rooms={rooms}
            handleEditRoomPrompt={handleEditRoomPrompt}
            deleteRoom={deleteRoom}
            newRoomInput={newRoomInput}
            setNewRoomInput={setNewRoomInput}
            handleAddRoom={handleAddRoom}
          />
          <CategoryMasterList
            categories={categories}
            categoryColors={categoryColors}
            updateCategoryColor={updateCategoryColor}
            handleEditCategoryPrompt={handleEditCategoryPrompt}
            deleteCategory={deleteCategory}
            newCategoryInput={newCategoryInput}
            setNewCategoryInput={setNewCategoryInput}
            handleAddCategory={handleAddCategory}
          />
        </div>
      </div>

      <DeviceGroupSection
        deviceGroups={deviceGroups}
        selectedGroupId={selectedGroupId}
        setSelectedGroupId={setSelectedGroupId}
        handleEditGroupPrompt={handleEditGroupPrompt}
        handleDeleteGroup={handleDeleteGroup}
        newGroupName={newGroupName}
        setNewGroupName={setNewGroupName}
        handleCreateGroup={handleCreateGroup}
        currentGroup={currentGroup}
        mccbList={mccbList}
        categoryColors={categoryColors}
        handleToggleDeviceInGroup={handleToggleDeviceInGroup}
      />

      <div className={UI_STYLES.sectionContainer}>
        <h2 className={UI_STYLES.sectionTitle}>📜 ログの管理</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RequestHistorySettingsPanel
            historySettings={historySettings}
            onChangeMaxHistorySize={onChangeMaxHistorySize}
            onClearRequestHistory={onClearRequestHistory}
          />

          <PrintModePanel
            currentRequestPrintMode={currentRequestPrintMode}
            onChangeRequestPrintMode={onChangeRequestPrintMode}
          />

          <DatabaseBackupPanel
            databaseBackups={databaseBackups}
            selectedBackupFileName={selectedBackupFileName}
            setSelectedBackupFile={setSelectedBackupFile}
            onCreateDatabaseBackup={onCreateDatabaseBackup}
            onRestoreDatabaseBackup={onRestoreDatabaseBackup}
          />

          <PrinterConnectionPanel
            starPrinterConnection={starPrinterConnection}
            starPrinterConnectionStatus={starPrinterConnectionStatus}
            isConnectingStarPrinter={isConnectingStarPrinter}
            isTestingStarPrinter={isTestingStarPrinter}
            handleConnectStarPrinter={handleConnectStarPrinter}
            handleClearStarPrinterConnection={handleClearStarPrinterConnection}
            handlePrintStarPrinterTestPage={handlePrintStarPrinterTestPage}
          />

          <LogHistoryTable
            logs={logs}
            logPageInfo={logPageInfo}
            logSettings={logSettings}
            onChangeMaxLogSize={onChangeMaxLogSize}
            onClearAllLogs={onClearAllLogs}
            onChangeLogPage={onChangeLogPage}
          />
        </div>
      </div>
    </div>
  );
}
