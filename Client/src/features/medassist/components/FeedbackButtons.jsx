import { ThumbsDown, ThumbsUp } from "lucide-react";

/** @param {{ value?: 1 | -1, onRate: (rating: 1 | -1) => void }} props */
export default function FeedbackButtons({ value, onRate }) {
  const voted = value === 1 || value === -1;
  const btn = (rating, Icon, label) => {
    const selected = value === rating;
    return (
      <button
        type="button"
        onClick={() => onRate(rating)}
        disabled={voted}
        aria-label={label}
        aria-pressed={selected}
        className={`p-1.5 rounded-lg transition-colors disabled:cursor-default ${
          selected
            ? "bg-primary-green/10 text-primary-green"
            : "text-text-secondary hover:bg-gray-100 hover:text-text-primary disabled:opacity-40 disabled:hover:bg-transparent"
        }`}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  };
  return (
    <div className="flex items-center gap-1">
      {btn(1, ThumbsUp, "Helpful answer")}
      {btn(-1, ThumbsDown, "Not helpful answer")}
    </div>
  );
}
