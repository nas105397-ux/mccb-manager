import { UI_STYLES } from "./adminStyles";

// 電気室マスター一覧の表示・追加・編集・削除。
export default function RoomMasterList({
  rooms,
  handleEditRoomPrompt,
  deleteRoom,
  newRoomInput,
  setNewRoomInput,
  handleAddRoom,
}) {
  return (
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
        <button onClick={handleAddRoom} className={UI_STYLES.btnSecondary}>
          ＋ 追加
        </button>
      </div>
    </div>
  );
}
