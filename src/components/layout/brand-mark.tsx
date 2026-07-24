import { ShieldCheck } from "lucide-react";

export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
        <ShieldCheck size={24} aria-hidden="true" />
      </div>
      <div>
        <p className="text-lg font-semibold text-white">RaroNexus</p>
        <p className="text-sm text-slate-400">Identity Provider</p>
      </div>
    </div>
  );
}
