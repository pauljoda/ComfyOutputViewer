type RatingStarsProps = {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  label?: string;
  allowClear?: boolean;
};

const STAR_PATH =
  'M12 3.8l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z';

export default function RatingStars({
  value,
  onChange,
  max = 5,
  disabled = false,
  size = 'md',
  className = '',
  label = 'Rating',
  allowClear = false
}: RatingStarsProps) {
  const stars = Array.from({ length: max }, (_, index) => index + 1);
  const handleSelect = (rating: number) => {
    if (!onChange || disabled) return;
    const next = allowClear && rating === value ? 0 : rating;
    onChange(next);
  };

  return (
    <div
      className={`rating-stars ${size === 'sm' ? 'compact' : ''} ${className}`.trim()}
      role={onChange ? 'radiogroup' : undefined}
      aria-label={label}
    >
      {stars.map((rating) => {
        const active = rating <= value;
        return (
          <button
            key={rating}
            type="button"
            className={active ? 'rating-star active' : 'rating-star'}
            onClick={() => handleSelect(rating)}
            disabled={disabled}
            aria-pressed={onChange ? active : undefined}
            aria-label={`Set rating to ${rating} star${rating === 1 ? '' : 's'}`}
            title={`Set rating to ${rating} star${rating === 1 ? '' : 's'}`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={STAR_PATH} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
