type Tab = {
  id: string;
  label: string;
  /** Optional count shown as a pill, e.g. how many variations exist. */
  count?: number;
};

type Props = {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
};

/** Underlined tab strip, used to split a card into sequential sections. */
export default function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div
      role="tablist"
      className="flex gap-1 border-b border-gray-200 dark:border-gray-800"
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
              isActive
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-theme-xs ${
                  isActive
                    ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                    : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
