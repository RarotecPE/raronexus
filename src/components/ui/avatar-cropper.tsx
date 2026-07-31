"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Save, X } from "lucide-react";

const CROP_SIZE = 320;
const OUTPUT_SIZE = 512;

type AvatarCropperProps = {
  file: File;
  onCancel: () => void;
  onCrop: (file: File) => void;
};

type ImageSize = {
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getBoundedOffset(
  offset: Point,
  imageSize: ImageSize | null,
  zoom: number,
) {
  if (!imageSize) return { x: 0, y: 0 };

  const coverScale = Math.max(CROP_SIZE / imageSize.width, CROP_SIZE / imageSize.height);
  const displayWidth = imageSize.width * coverScale * zoom;
  const displayHeight = imageSize.height * coverScale * zoom;
  const maxX = Math.max(0, (displayWidth - CROP_SIZE) / 2);
  const maxY = Math.max(0, (displayHeight - CROP_SIZE) / 2);

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
}

function buildCroppedAvatar(
  image: HTMLImageElement,
  file: File,
  imageSize: ImageSize,
  zoom: number,
  offset: Point,
) {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Nao foi possivel preparar a imagem.");
  }

  const coverScale = Math.max(CROP_SIZE / imageSize.width, CROP_SIZE / imageSize.height);
  const displayScale = coverScale * zoom;
  const displayWidth = imageSize.width * displayScale;
  const displayHeight = imageSize.height * displayScale;
  const imageLeft = CROP_SIZE / 2 - displayWidth / 2 + offset.x;
  const imageTop = CROP_SIZE / 2 - displayHeight / 2 + offset.y;
  const sourceX = Math.max(0, -imageLeft / displayScale);
  const sourceY = Math.max(0, -imageTop / displayScale);
  const sourceSize = CROP_SIZE / displayScale;

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Nao foi possivel recortar a imagem."));
        return;
      }

      const name = file.name.replace(/\.[^.]+$/, "") || "avatar";
      resolve(new File([blob], `${name}-quadrado.png`, { type: "image/png" }));
    }, "image/png");
  });
}

export function AvatarCropper({ file, onCancel, onCrop }: AvatarCropperProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<Point | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const coverScale = imageSize
    ? Math.max(CROP_SIZE / imageSize.width, CROP_SIZE / imageSize.height)
    : 1;
  const displayWidth = imageSize ? imageSize.width * coverScale * zoom : CROP_SIZE;
  const displayHeight = imageSize ? imageSize.height * coverScale * zoom : CROP_SIZE;
  const boundedOffset = getBoundedOffset(offset, imageSize, zoom);

  useEffect(() => {
    let active = true;
    const reader = new FileReader();

    reader.onload = () => {
      if (active && typeof reader.result === "string") {
        setImageUrl(reader.result);
        setImageSize(null);
        setOffset({ x: 0, y: 0 });
        setZoom(1);
      }
    };

    reader.onerror = () => {
      if (active) setError("Nao foi possivel carregar a imagem.");
    };

    reader.readAsDataURL(file);

    return () => {
      active = false;
      reader.abort();
    };
  }, [file]);

  async function handleCrop() {
    if (!imageRef.current || !imageSize) return;

    setSaving(true);
    setError("");

    try {
      const cropped = await buildCroppedAvatar(
        imageRef.current,
        file,
        imageSize,
        zoom,
        boundedOffset,
      );
      onCrop(cropped);
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : "Erro ao recortar imagem.");
      setSaving(false);
    }
  }

  function handleCancel() {
    onCancel();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <section className="panel w-full max-w-md p-5 shadow-2xl shadow-cyan-950/40">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-cyan-200">
              <ImageIcon size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Ajustar foto</h2>
              <p className="text-sm text-slate-400">Selecione a parte que aparecera no perfil.</p>
            </div>
          </div>
          <button className="btn-secondary min-h-9 px-3 py-2" type="button" onClick={handleCancel} title="Fechar">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div
          className="relative mx-auto aspect-square w-full max-w-80 touch-none overflow-hidden rounded-lg border border-cyan-400/25 bg-slate-950"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
              x: event.clientX - boundedOffset.x,
              y: event.clientY - boundedOffset.y,
            };
          }}
          onPointerMove={(event) => {
            if (!dragRef.current) return;
            setOffset(getBoundedOffset({
              x: event.clientX - dragRef.current.x,
              y: event.clientY - dragRef.current.y,
            }, imageSize, zoom));
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {imageUrl ? (
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Previa do avatar"
              className="absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: `${displayWidth}px`,
                height: `${displayHeight}px`,
                transform: `translate(calc(-50% + ${boundedOffset.x}px), calc(-50% + ${boundedOffset.y}px))`,
              }}
              draggable={false}
              onLoad={(event) => {
                const image = event.currentTarget;
                setImageSize({
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                });
                setOffset({ x: 0, y: 0 });
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Carregando imagem...
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-white/80" />
        </div>

        <label className="mt-4 grid gap-2 text-sm font-medium text-slate-200">
          Zoom
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => {
              const nextZoom = Number(event.target.value);
              setZoom(nextZoom);
              setOffset((current) => getBoundedOffset(current, imageSize, nextZoom));
            }}
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button className="btn-primary" type="button" disabled={saving || !imageSize} onClick={() => void handleCrop()}>
            <Save size={17} aria-hidden="true" />
            {saving ? "Salvando..." : "Usar foto"}
          </button>
          <button className="btn-secondary" type="button" onClick={handleCancel}>
            Cancelar
          </button>
        </div>
      </section>
    </div>
  );
}
