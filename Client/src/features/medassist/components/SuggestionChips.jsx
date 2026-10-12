import { Sparkles } from "lucide-react";

/** @param {{ productName?: string, onPick: (q: string) => void, disabled?: boolean }} props */
export default function SuggestionChips({ productName, onPick, disabled }) {
  const chips = productName
    ? [
        `Side effects of ${productName}?`,
        `Can I take ${productName} with other medicines?`,
        `Is ${productName} in stock?`,
      ]
    : ["Paracetamol side effects?", "Brufen aur Panadol ek saath?", "Is Augmentin in stock?"];

  return (
    <div className="flex flex-col items-center text-center px-2 py-6">
      <div className="w-14 h-14 rounded-2xl bg-primary-green/10 flex items-center justify-center mb-3">
        <Sparkles className="w-7 h-7 text-primary-green" />
      </div>
      <p className="text-sm font-semibold text-text-primary">Ask about any medicine</p>
      <p className="mt-1 text-xs text-text-secondary">Uses, side effects, interactions and stock.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {chips.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            disabled={disabled}
            className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-medium text-text-primary text-left hover:border-primary-green/50 hover:text-primary-green transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
