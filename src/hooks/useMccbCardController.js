import { useCallback, useMemo } from 'react';

export function useMccbCardController({ mccbId, isFavorite, onSelect, onToggleFavorite, requests }) {
  const hasActiveRequest = useMemo(() => {
    if (!requests?.length) return false;

    return requests.some(({ reservedCards }) => {
      if (!reservedCards) return false;

      return Object.entries(reservedCards).some(([originalMccbId, resInfo]) => {
        if (!resInfo) return false;
        return originalMccbId === mccbId || resInfo.actualMccbId === mccbId;
      });
    });
  }, [mccbId, requests]);

  const handleSelect = useCallback(() => {
    onSelect?.(mccbId);
  }, [mccbId, onSelect]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') onSelect?.(mccbId);
  }, [mccbId, onSelect]);

  const handleToggleFavorite = useCallback((e) => {
    e.stopPropagation();
    onToggleFavorite?.(mccbId, isFavorite);
  }, [mccbId, isFavorite, onToggleFavorite]);

  return {
    hasActiveRequest,
    handleSelect,
    handleKeyDown,
    handleToggleFavorite,
  };
}
