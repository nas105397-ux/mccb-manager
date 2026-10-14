// 電気室の簡略図(public/maps/*.svg)で MCCB の場所を表示する。管理者は盤・区切りを選んで登録できる。
// SVG は scripts/buildRoomMaps.py で生成する。盤は <g id="盤ID">、区切りは data-section で特定する。
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORY_COLOR_PRESETS,
  getCategoryColorKey,
} from "../shared/categoryColorUtils";
import { formatMccbLocation } from "../shared/mccbViewUtils";

const FLOORS = ["1F", "2F"];
const ZOOM_STEPS = [1, 1.5, 2, 3];

const MAP_STYLE = `
.room-map svg{width:100%;height:auto;display:block}
.room-map .panel-group{cursor:var(--panel-cursor,default)}
.room-map .is-target>.panel{fill:#fecaca;stroke:#dc2626;stroke-width:6;animation:room-map-blink 1s infinite}
.room-map .is-target>.section{stroke:#dc2626}
.room-map .section.is-target-section{fill:#f87171;animation:room-map-blink 1s infinite}
.room-map .is-picked>.panel{stroke:#2563eb;stroke-width:6}
.room-map .section.is-picked-section{fill:#bfdbfe}
@keyframes room-map-blink{50%{opacity:.45}}
`;

const guessFloor = (mccb) =>
  mccb.location?.floor || (mccb.room?.startsWith("2階") ? "2F" : "1F");

// 盤(と区切り)に強調用クラスを付ける。見つかった要素を返す。
const markLocation = (root, location, panelClass, sectionClass) => {
  if (!location?.panelId) return null;
  const panel = root.querySelector(`#${CSS.escape(location.panelId)}`);
  if (!panel) return null;
  panel.classList.add(panelClass);
  const section = location.section
    ? panel.querySelector(`[data-section="${CSS.escape(location.section)}"]`)
    : null;
  section?.classList.add(sectionClass);
  return section || panel;
};

export default function RoomMapModal({
  mccb,
  isAdmin,
  onUpdate,
  onClose,
  categoryColors,
}) {
  const [floor, setFloor] = useState(() => guessFloor(mccb));
  // 読み込んだ階と一緒に持ち、階の切替直後は前の階の図を出さない
  const [loaded, setLoaded] = useState({ floor: null, svg: "", error: "" });
  const svg = loaded.floor === floor ? loaded.svg : "";
  const loadError = loaded.floor === floor ? loaded.error : "";
  // 同じオブジェクトを渡し続けないと、再描画のたびに SVG が入れ直されて強調表示が消える
  const svgHtml = useMemo(() => ({ __html: svg }), [svg]);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const mapRef = useRef(null);
  const location = mccb.location;

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}maps/${floor}.svg`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      })
      .then((text) => alive && setLoaded({ floor, svg: text, error: "" }))
      .catch(
        () =>
          alive &&
          setLoaded({ floor, svg: "", error: `${floor} の図を読み込めませんでした。` }),
      );
    return () => {
      alive = false;
    };
  }, [floor]);

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // 強調表示とストランド色(管理画面の区分色)を SVG に反映する。
  useEffect(() => {
    const root = mapRef.current;
    if (!root || !svg) return;
    ["is-target", "is-target-section", "is-picked", "is-picked-section"].forEach((cls) =>
      root.querySelectorAll(`.${cls}`).forEach((el) => el.classList.remove(cls)),
    );
    if (location?.floor === floor) {
      markLocation(root, location, "is-target", "is-target-section");
    }
    if (picked?.floor === floor) {
      markLocation(root, picked, "is-picked", "is-picked-section");
    }
    root.querySelectorAll("[data-category]").forEach((el) => {
      const preset = CATEGORY_COLOR_PRESETS[getCategoryColorKey(el.dataset.category, categoryColors)];
      if (el.tagName === "text") {
        el.setAttribute("fill", preset.textHex);
      } else {
        // 白は薄い帯だと見えないため、背景帯だけ灰色にする
        const isBand = el.classList.contains("strand-band");
        el.setAttribute("fill", isBand && preset.hex === "#ffffff" ? "#e5e7eb" : preset.hex);
      }
    });
  }, [svg, floor, location, picked, categoryColors]);

  // 図を開いた時・階を切り替えた時だけ、対象の盤までスクロールする。
  useEffect(() => {
    const root = mapRef.current;
    if (!root || !svg || location?.floor !== floor) return;
    root.querySelector(".is-target-section, .is-target")
      ?.scrollIntoView({ block: "center", inline: "center" });
  }, [svg, floor, location, zoomIndex]);

  const handleMapClick = (e) => {
    if (!isAdmin) return;
    const panel = e.target.closest(".panel-group");
    if (!panel) return;
    const section = e.target.closest("[data-section]")?.dataset.section || "";
    setPicked({ floor, panelId: panel.id, section });
  };

  const handleSave = (nextLocation) => {
    onUpdate({ ...mccb, location: nextLocation });
    setPicked(null);
  };

  const registeredText = formatMccbLocation(location);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4 print:hidden"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${mccb.name} の場所`}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-gray-200 w-full max-w-4xl overflow-hidden flex flex-col h-[92vh]"
      >
        <div className="bg-gray-50 border-b p-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">📍 場所</p>
            <h2 className="text-base font-black text-gray-800 break-words">{mccb.name}</h2>
            <p className="text-xs font-bold text-red-700">
              {registeredText || "場所が未登録です"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 font-bold text-gray-700 hover:bg-gray-100"
          >
            操作画面に戻る
          </button>
        </div>

        <div className="border-b p-2 flex flex-wrap items-center gap-2 shrink-0 text-sm">
          {FLOORS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={floor === f}
              onClick={() => setFloor(f)}
              className={`rounded-lg px-4 py-1.5 font-bold border ${
                floor === f
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
              }`}
            >
              {f}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="縮小"
              disabled={zoomIndex === 0}
              onClick={() => setZoomIndex((i) => i - 1)}
              className="w-9 h-9 rounded-lg border border-gray-300 font-black disabled:opacity-40"
            >
              −
            </button>
            <span className="w-12 text-center text-xs text-gray-600">
              {Math.round(ZOOM_STEPS[zoomIndex] * 100)}%
            </span>
            <button
              type="button"
              aria-label="拡大"
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              onClick={() => setZoomIndex((i) => i + 1)}
              className="w-9 h-9 rounded-lg border border-gray-300 font-black disabled:opacity-40"
            >
              ＋
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100">
          <style>{MAP_STYLE}</style>
          {loadError ? (
            <p className="p-6 text-center text-red-600 font-bold">{loadError}</p>
          ) : (
            <div
              ref={mapRef}
              onClick={handleMapClick}
              className="room-map mx-auto"
              style={{
                width: `${ZOOM_STEPS[zoomIndex] * 100}%`,
                maxWidth: `${ZOOM_STEPS[zoomIndex] * 720}px`,
                "--panel-cursor": isAdmin ? "pointer" : "default",
              }}
              // 自前で生成した public/maps の SVG のみを読み込む
              dangerouslySetInnerHTML={svgHtml}
            />
          )}
        </div>

        {isAdmin && (
          <div className="border-t bg-amber-50 p-3 flex flex-wrap items-center gap-2 shrink-0 text-sm">
            <span className="font-bold text-amber-900">
              🔧 場所の登録:
              {picked
                ? ` ${formatMccbLocation(picked)}`
                : " 図の盤(区切り)をタップして選択"}
            </span>
            <div className="ml-auto flex gap-2">
              {location?.panelId && (
                <button
                  type="button"
                  onClick={() => handleSave(null)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-bold text-gray-700 hover:bg-gray-100"
                >
                  登録解除
                </button>
              )}
              <button
                type="button"
                disabled={!picked}
                onClick={() => handleSave(picked)}
                className="rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700 disabled:opacity-40"
              >
                この位置に登録
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
