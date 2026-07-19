// 進行中・仮発行の「対象設備一覧」開閉トグル行。履歴では補足ヒントを表示しない。
export default function FoldToggleRow({ isExpanded, onClick, label, count, className, hintClassName }) {
  return (
    <div
      onClick={onClick}
      className={className}
      title={hintClassName ? (isExpanded ? "クリックで非表示" : "クリックで表示") : undefined}
    >
      <span>
        {isExpanded ? "▼" : "▶"} {label} ({count}面)
      </span>
      {hintClassName && (
        <span className={hintClassName}>
          {isExpanded ? "[ クリックで折りたたむ ]" : "[ クリックで展開する ]"}
        </span>
      )}
    </div>
  );
}
