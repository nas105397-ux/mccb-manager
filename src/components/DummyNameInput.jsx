// ダミー札を選んだときに入力する「実際に作業する設備名称」の入力欄。
// 依頼作成画面と依頼一覧の設備追加パネルで共用する。
import { useState } from "react";

const INPUT_DUMMY_CLASS =
  "border p-1.5 rounded text-[11px] w-full bg-white focus:outline-none font-medium text-gray-700";

export default function DummyNameInput({ mccbId, value, onChange }) {
  const [draft, setDraft] = useState(() => value || "");

  const commitValue = (nextValue) => {
    if ((value || "") !== nextValue) {
      onChange(mccbId, nextValue);
    }
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => {
        const nextValue = e.target.value;
        setDraft(nextValue);
      }}
      onBlur={() => commitValue(draft)}
      placeholder="✏️ 代替する実際の設備名称を入力"
      className={INPUT_DUMMY_CLASS}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}
