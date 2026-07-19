import { useEffect } from "react";

// 複数の要素とウィンドウのリサイズ監視をまとめ、変化のたびに callback を呼び出す。
// callback 内で ref.current を読んで最新のサイズを反映すること。
export function useResizeObserverEffect(refs, callback, deps = []) {
  useEffect(() => {
    callback();
    window.addEventListener("resize", callback);

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(callback);
      refs.forEach((ref) => {
        if (ref.current) observer.observe(ref.current);
      });
    }

    return () => {
      window.removeEventListener("resize", callback);
      if (observer) observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
