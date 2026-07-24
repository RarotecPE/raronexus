import { BrandMark } from "@/components/layout/brand-mark";
import { SwaggerClient } from "./swagger-client";

export default function SwaggerPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <BrandMark />
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Documentacao da API
          </h1>
        </div>
        <SwaggerClient />
      </div>
    </main>
  );
}
