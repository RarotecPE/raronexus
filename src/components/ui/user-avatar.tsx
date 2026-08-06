"use client";

import { UserRound } from "lucide-react";
import { useState } from "react";

type UserAvatarProps = {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
  lg: "h-20 w-20",
};

export function UserAvatar({ src, name, size = "sm" }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const imageSrc = src || "";
  const showImage = Boolean(imageSrc) && !failed;

  return (
    <div
      className={`${sizeClasses[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-cyan-400/20 bg-slate-800 text-slate-400`}
      aria-hidden="true"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <UserRound size={size === "lg" ? 34 : size === "md" ? 20 : 18} aria-hidden="true" />
      )}
      <span className="sr-only">{name}</span>
    </div>
  );
}
