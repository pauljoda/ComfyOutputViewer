import { describe, expect, it } from 'vitest';
import { toggleSelectionWithRange } from './selection';

describe('toggleSelectionWithRange', () => {
  it('toggles a single selection when shift is not held', () => {
    expect(
      toggleSelectionWithRange({
        orderedIds: ['a', 'b', 'c'],
        selectedIds: [],
        clickedId: 'b',
        anchorId: null
      })
    ).toEqual({
      selectedIds: ['b'],
      anchorId: 'b'
    });

    expect(
      toggleSelectionWithRange({
        orderedIds: ['a', 'b', 'c'],
        selectedIds: ['b'],
        clickedId: 'b',
        anchorId: 'b'
      })
    ).toEqual({
      selectedIds: [],
      anchorId: 'b'
    });
  });

  it('selects a range from the existing anchor when shift is held', () => {
    expect(
      toggleSelectionWithRange({
        orderedIds: ['a', 'b', 'c', 'd', 'e'],
        selectedIds: ['c'],
        clickedId: 'e',
        anchorId: 'c',
        shiftKey: true
      })
    ).toEqual({
      selectedIds: ['c', 'd', 'e'],
      anchorId: 'c'
    });
  });

  it('starts from the first visible item when shift-select has no anchor', () => {
    expect(
      toggleSelectionWithRange({
        orderedIds: ['a', 'b', 'c', 'd'],
        selectedIds: [],
        clickedId: 'c',
        anchorId: null,
        shiftKey: true
      })
    ).toEqual({
      selectedIds: ['a', 'b', 'c'],
      anchorId: 'a'
    });
  });

  it('keeps existing selection and adds the shift-selected range', () => {
    expect(
      toggleSelectionWithRange({
        orderedIds: ['a', 'b', 'c', 'd', 'e', 'f'],
        selectedIds: ['f'],
        clickedId: 'd',
        anchorId: 'b',
        shiftKey: true
      })
    ).toEqual({
      selectedIds: ['b', 'c', 'd', 'f'],
      anchorId: 'b'
    });
  });
});
