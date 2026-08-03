"use client";

import { useState } from "react";

type ApplicationLogoProps = {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "md";
};

const sizeClasses = {
  sm: "h-10 w-10 text-xs",
  md: "h-12 w-12 text-sm",
};

function getApplicationInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "APP";
}

export function ApplicationLogo({ name, logoUrl, size = "md" }: ApplicationLogoProps) {
  const [failed, setFailed] = useState(false);
  const imageSrc = logoUrl || "";
  const showLogo = Boolean(imageSrc) && !failed;

  if (showLogo) {
    return (
      <div className={`${sizeClasses[size]} shrink-0 overflow-hidden rounded-lg border border-cyan-400/25 bg-white shadow-inner shadow-cyan-950/40`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-cyan-400/25 bg-cyan-950/35 font-semibold text-cyan-100 shadow-inner shadow-cyan-950/40`}>
      {getApplicationInitials(name)}
    </div>
  );
}
