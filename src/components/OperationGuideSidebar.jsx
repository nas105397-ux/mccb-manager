// 画面別の操作ガイドを右側に表示する補助パネル。
const GUIDE_CONTENT = {
  operation: {
    eyebrow: "OPERATION GUIDE",
    title: "禁止札操作",
    notice: "操作前に対象設備名、電気室、状態、子札の貸出状況を必ず確認してください。",
    sections: [
      {
        title: "対象を確認",
        items: [
          "緑は通常送電、赤は操作禁止、青は子札返却済みで送電可能な状態です。",
          "黄色の枠は依頼発行中の設備です。作業依頼と紐づいている可能性があります。",
          "上部の件数表示で、登録数・送電中・停電中の全体状況を確認できます。",
        ],
      },
      {
        title: "設備を絞り込む",
        items: [
          "設備名称で検索すると、入力から少し待って一覧が絞り込まれます。",
          "電気室、状態、お気に入りを組み合わせて対象を絞り込めます。",
          "星マークを押すと、お気に入り登録と解除を切り替えられます。",
        ],
      },
      {
        title: "操作禁止の切り替え",
        items: [
          "設備カードをクリックすると操作画面が開きます。",
          "操作禁止にする時は、設備停電ステータスを通常運用から操作禁止へ切り替えます。",
          "送電へ戻す時は、未返却の子札がないことを確認してから通常運用へ切り替えます。",
        ],
      },
      {
        title: "子札を扱う",
        items: [
          "空き札は使用者名を入力して貸出できます。",
          "貸出中の札は返却すると保管中に戻ります。",
          "依頼から一時返却された札は、再貸出で同じ依頼へ戻せます。",
        ],
      },
    ],
  },
  request: {
    eyebrow: "REQUEST GUIDE",
    title: "依頼発行・印刷",
    notice: "発行前に作業責任者、作業内容、対象設備、子札番号のプレビューを確認してください。",
    sections: [
      {
        title: "基本情報を入力",
        items: [
          "作業責任者名と作業内容・目的を入力します。どちらも依頼表に表示されます。",
          "作業内容は依頼一覧で見出しとして表示されるため、作業を判別しやすい名称にします。",
        ],
      },
      {
        title: "対象設備を選ぶ",
        items: [
          "設備名や電気室で検索し、対象設備にチェックを入れます。",
          "グループ一括選択がある場合は、登録済みグループを押すと対象をまとめて選択できます。",
          "ダミー設備を選択した場合は、実際に作業する設備名称を代替名として入力します。",
        ],
      },
      {
        title: "プレビュー確認",
        items: [
          "右側のプレビューで依頼番号、作業者、作業内容、対象設備、子札番号を確認します。",
          "子札に空きがない設備は、発行前に対象設備や貸出状況を調整します。",
        ],
      },
      {
        title: "発行または仮発行",
        items: [
          "停電依頼を発行すると、依頼一覧の進行中に登録され、対象設備は依頼発行中として扱われます。",
          "仮発行として保存すると、子札未割当のまま依頼一覧に残り、後から正式発行できます。",
          "印刷の有無や印刷方式は管理者画面の設定に従います。",
        ],
      },
    ],
  },
  requestList: {
    eyebrow: "REQUEST LIST GUIDE",
    title: "依頼一覧・進捗",
    notice: "解約・作業完了を押すと依頼が完了扱いになり、使用中の札が解放されます。",
    sections: [
      {
        title: "表示を切り替える",
        items: [
          "進行中では、発行済みで完了していない依頼を確認できます。",
          "仮発行では、正式発行前の依頼を確認し、必要に応じて発行または削除できます。",
          "履歴では、完了または解約した依頼の記録を確認できます。",
        ],
      },
      {
        title: "進行中依頼を扱う",
        items: [
          "停電対象設備一覧を展開すると、対象設備ごとの状態と使用札を確認できます。",
          "停電設備を追加から、発行済み依頼に対象設備を後から追加できます。",
          "依頼表を印刷すると、現在登録されている依頼内容を再印刷できます。",
        ],
      },
      {
        title: "子札の一時返却",
        items: [
          "貸出中の設備は一時返却を押すと、子札返却済みの状態にできます。",
          "一時返却中の設備は再貸出を押すと、同じ依頼内で再び貸出中に戻せます。",
        ],
      },
      {
        title: "完了と履歴",
        items: [
          "対象設備の停電対応が終わったら、状態表示を確認してから解約・作業完了を実行します。",
          "完了した依頼は履歴に移動し、発行日時、完了日時、対象設備を後から確認できます。",
          "履歴が多い場合は下部の前へ・次へでページを切り替えます。",
        ],
      },
    ],
  },
  admin: {
    eyebrow: "ADMIN GUIDE",
    title: "管理画面",
    notice: "管理画面の変更は全端末の表示と運用に影響します。作業前に対象と内容を確認してください。",
    sections: [
      {
        title: "設備を登録・更新",
        items: [
          "電気室、区分、設備名称を入力して設備を個別登録します。",
          "CSV取込は現在の設備データを上書きします。取込前にCSVの電気室と区分がマスター登録済みか確認します。",
          "CSVエクスポートで現在の設備データを控えとして保存できます。",
        ],
      },
      {
        title: "マスターを整える",
        items: [
          "電気室マスターと区分マスターは、設備登録や検索条件に使われます。",
          "区分カラーを変更すると、設備カードの表示色に反映されます。",
          "設備グループを登録すると、依頼発行画面で対象設備を一括選択できます。",
        ],
      },
      {
        title: "履歴・ログを管理",
        items: [
          "依頼履歴の保持件数を設定し、不要になった履歴は全削除できます。",
          "操作ログの保持件数を設定し、必要に応じてログを確認または全削除します。",
          "削除操作は戻せないため、必要な記録を確認してから実行します。",
        ],
      },
      {
        title: "バックアップ・印刷",
        items: [
          "DBバックアップ作成で現在のSQLite DBを保存します。保守作業前に取得してください。",
          "DB復旧は選択したバックアップ時点の内容へ戻します。実行前に復旧元ファイルを確認してください。",
          "依頼表の印刷方式は、スター精密レシート印刷、ブラウザ印刷、印刷なしから選択します。",
          "スター精密プリンターを使う端末では、USB接続情報を保存してからテスト印刷します。",
        ],
      },
    ],
  },
};

export default function OperationGuideSidebar({ isOpen, onClose, guideType = "operation" }) {
  if (!isOpen) return null;

  const guide = GUIDE_CONTENT[guideType] || GUIDE_CONTENT.operation;

  return (
    <aside className="fixed inset-y-4 right-4 z-40 flex w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-blue-100 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-blue-50 bg-blue-50 px-4 py-3">
        <div className="text-left">
          <p className="text-[11px] font-black text-blue-500 tracking-wide">
            {guide.eyebrow}
          </p>
          <h2 className="text-base font-black text-gray-850 leading-tight">
            {guide.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg border border-blue-200 bg-white text-sm font-black text-blue-700 cursor-pointer hover:bg-blue-100"
          aria-label="操作説明を閉じる"
          title="閉じる"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 text-left">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-relaxed text-amber-900">
          {guide.notice}
        </div>

        <div className="mt-4 space-y-4">
          {guide.sections.map((section, sectionIndex) => (
            <section key={section.title} className="border-b border-gray-100 pb-4 last:border-b-0">
              <h3 className="flex items-center gap-2 text-sm font-black text-gray-800">
                <span className="grid h-6 w-6 place-items-center rounded bg-gray-900 text-[11px] text-white">
                  {sectionIndex + 1}
                </span>
                {section.title}
              </h3>
              <ul className="mt-2 space-y-2 text-xs font-bold leading-relaxed text-gray-600">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}
