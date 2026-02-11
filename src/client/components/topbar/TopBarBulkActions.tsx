import { EyeOff, Heart, Tag, Trash2, Wand2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import RatingStars from '../RatingStars';

type TopBarBulkActionsProps = {
  selectedCount: number;
  imageCount: number;
  bulkRatingValue: number;
  onBulkRatingChange: (rating: number) => void;
  bulkTagInput: string;
  onBulkTagInputChange: (value: string) => void;
  bulkTagSuggestions: string[];
  onClearSelection: () => void;
  onBulkFavorite: () => void;
  onBulkHidden: () => void;
  onBulkDelete: () => void;
  onAutoTag: () => void;
  onAutoTagView: () => void;
  onBulkTag: (tag: string) => void;
};

export default function TopBarBulkActions({
  selectedCount,
  imageCount,
  bulkRatingValue,
  onBulkRatingChange,
  bulkTagInput,
  onBulkTagInputChange,
  bulkTagSuggestions,
  onClearSelection,
  onBulkFavorite,
  onBulkHidden,
  onBulkDelete,
  onAutoTag,
  onAutoTagView,
  onBulkTag
}: TopBarBulkActionsProps) {
  return (
    <div className="border-t bg-muted/50 px-3 py-2 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">Multi-select</span>
        <Badge variant="outline">{selectedCount} selected</Badge>
        <Button variant="ghost" size="sm" onClick={onClearSelection} disabled={selectedCount === 0}>
          Clear
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBulkFavorite} disabled={selectedCount === 0}>
          <Heart className="mr-1 h-3.5 w-3.5" />
          Favorite
        </Button>
        <Button variant="outline" size="sm" onClick={onBulkHidden} disabled={selectedCount === 0}>
          <EyeOff className="mr-1 h-3.5 w-3.5" />
          Hide
        </Button>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Rate</span>
          <RatingStars
            value={bulkRatingValue}
            onChange={onBulkRatingChange}
            size="sm"
            disabled={selectedCount === 0}
            allowClear
            label="Rate selected images"
          />
        </div>
        <Button variant="destructive" size="sm" onClick={onBulkDelete} disabled={selectedCount === 0}>
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Remove
        </Button>
        <Button variant="outline" size="sm" onClick={onAutoTag} disabled={selectedCount === 0}>
          <Wand2 className="mr-1 h-3.5 w-3.5" />
          Auto Tag
        </Button>
        <Button variant="outline" size="sm" onClick={onAutoTagView} disabled={imageCount === 0}>
          <Wand2 className="mr-1 h-3.5 w-3.5" />
          Auto Tag View
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <input
          list="bulk-tag-suggestions"
          name="bulkTag"
          autoComplete="off"
          value={bulkTagInput}
          onChange={(event) => onBulkTagInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (bulkTagInput.trim() && selectedCount > 0) {
                onBulkTag(bulkTagInput);
                onBulkTagInputChange('');
              }
            }
          }}
          placeholder="Tag selected…"
          aria-label="Tag selected"
          disabled={selectedCount === 0}
          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onBulkTag(bulkTagInput);
            onBulkTagInputChange('');
          }}
          disabled={!bulkTagInput.trim() || selectedCount === 0}
        >
          <Tag className="mr-1 h-3.5 w-3.5" />
          Tag all
        </Button>
      </div>
      {bulkTagSuggestions.length > 0 && selectedCount > 0 && (
        <div className="max-h-28 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-1.5">
          <div className="flex flex-wrap gap-1">
            {bulkTagSuggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  onBulkTag(tag);
                  onBulkTagInputChange('');
                }}
                title="Tag selected"
                className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground hover:bg-secondary/80"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
      <datalist id="bulk-tag-suggestions">
        {bulkTagSuggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </div>
  );
}
