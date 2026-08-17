import Image from "next/image";
import { BRAND_LOGO_URL } from "@/lib/brand";

export function BrandMark() {
  return (
    <div className="flex items-center gap-3" aria-label="Rarotec RaroNexus">
      <Image
        src={BRAND_LOGO_URL}
        alt="Rarotec"
        width={44}
        height={44}
        className="h-11 w-11 object-contain"
        priority
      />
    </div>
  );
}
