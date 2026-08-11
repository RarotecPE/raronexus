export function getEnvironmentLabel() {
  return process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL?.trim() ?? "";
}

export function EnvironmentBanner() {
  const label = getEnvironmentLabel();

  if (!label) return null;

  return (
    <div className="fixed top-3 left-1/2 z-[1000] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center justify-center rounded-full border border-amber-300/50 bg-amber-400 px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-950 shadow-[0_8px_28px_rgba(0,0,0,0.28)] transition-opacity duration-200 hover:opacity-0 focus-visible:opacity-0 sm:inset-x-0 sm:bottom-0 sm:left-0 sm:top-auto sm:h-7 sm:max-w-none sm:translate-x-0 sm:rounded-none sm:border-x-0 sm:border-b-0 sm:border-t sm:border-amber-300/40 sm:bg-amber-500 sm:px-3 sm:py-0 sm:text-xs sm:tracking-[0.22em] sm:shadow-[0_-8px_24px_rgba(0,0,0,0.25)]">
      <span className="truncate">{label}</span>
    </div>
  );
}