import { useCallback } from "react";

export function useMccbCardController({
  mccbId,
  isFavorite,
  onSelect,
  onToggleFavorite,
}) {
  const handleSelect = useCallback(() => {
    onSelect?.(mccbId);
  }, [mccbId, onSelect]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") onSelect?.(mccbId);
    },
    [mccbId, onSelect],
  );

  const handleToggleFavorite = useCallback(
    (e) => {
      e.stopPropagation();
      onToggleFavorite?.(mccbId, isFavorite);
    },
    [mccbId, isFavorite, onToggleFavorite],
  );

  return {
    handleSelect,
    handleKeyDown,
    handleToggleFavorite,
  };
}
