export function PconReferenceMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <path fill="#10b981" d="M18 2 31 9.5v15L18 32 5 24.5v-15Z" />
      <path fill="#047857" d="M18 2v10.8l-7 4.1v12L5 24.5v-15Z" />
      <path fill="#34d399" d="m18 12.8 7.1 4.1-7.1 4.2-7-4.2Z" />
      <path fill="#fff" d="m18 9.2 8 4.6v9.1L18 27.5l-4-2.3v-5.1l4 2.3 4-2.3v-4.6l-4-2.3-4 2.3-4-2.3Z" />
    </svg>
  );
}
