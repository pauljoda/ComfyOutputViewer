type ToggleSelectionWithRangeArgs = {
  orderedIds: string[];
  selectedIds: string[];
  clickedId: string;
  anchorId: string | null;
  shiftKey?: boolean;
};

type ToggleSelectionWithRangeResult = {
  selectedIds: string[];
  anchorId: string;
};

export function toggleSelectionWithRange({
  orderedIds,
  selectedIds,
  clickedId,
  anchorId,
  shiftKey = false
}: ToggleSelectionWithRangeArgs): ToggleSelectionWithRangeResult {
  if (!orderedIds.includes(clickedId)) {
    return {
      selectedIds,
      anchorId: anchorId && orderedIds.includes(anchorId) ? anchorId : clickedId
    };
  }

  if (!shiftKey) {
    const nextSelectedIds = selectedIds.includes(clickedId)
      ? selectedIds.filter((id) => id !== clickedId)
      : [...selectedIds, clickedId];
    return {
      selectedIds: nextSelectedIds,
      anchorId: clickedId
    };
  }

  const fallbackAnchorId = orderedIds[0];
  const effectiveAnchorId =
    anchorId && orderedIds.includes(anchorId) ? anchorId : fallbackAnchorId;
  const anchorIndex = orderedIds.indexOf(effectiveAnchorId);
  const clickedIndex = orderedIds.indexOf(clickedId);
  const start = Math.min(anchorIndex, clickedIndex);
  const end = Math.max(anchorIndex, clickedIndex);
  const rangeIds = orderedIds.slice(start, end + 1);
  const nextSet = new Set(selectedIds);
  rangeIds.forEach((id) => nextSet.add(id));

  return {
    selectedIds: orderedIds.filter((id) => nextSet.has(id)),
    anchorId: effectiveAnchorId
  };
}
