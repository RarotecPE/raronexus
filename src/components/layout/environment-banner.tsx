export function getEnvironmentLabel() {
  return process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL?.trim() ?? "";
}

export function EnvironmentBanner() {
  const label = getEnvironmentLabel();

  if (!label) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] flex h-7 items-center justify-center border-t border-amber-300/40 bg-amber-500 px-3 text-center text-xs font-bold uppercase tracking-[0.22em] text-slate-950 shadow-[0_-8px_24px_rgba(0,0,0,0.25)]">
      {label}
    </div>
  );
}
