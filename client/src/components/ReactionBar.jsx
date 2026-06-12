// Hizli tepki secici (FAZ 4) - bir baloncuga dokununca cikar.

const QUICK = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

export default function ReactionBar({ mine, current, onPick }) {
  return (
    <div
      className={`mb-1 flex gap-0.5 rounded-full border border-gray-200 bg-white p-1 shadow-md dark:border-neutral-700 dark:bg-neutral-800 ${
        mine ? 'ml-auto' : ''
      }`}
    >
      {QUICK.map((e) => (
        <button
          key={e}
          onClick={() => onPick(current === e ? null : e)}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:scale-110 ${
            current === e ? 'bg-fuchsia-100 dark:bg-fuchsia-900/50' : ''
          }`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
