"use client";

import Image from "next/image";
import { useState } from "react";

type ProductDemoImageProps = {
  src?: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  productName?: string;
};

export function ProductDemoImage({
  src,
  alt,
  sizes = "100vw",
  priority = false,
  className = "object-cover object-top",
  productName = "ADN Capital",
}: ProductDemoImageProps) {
  const [failed, setFailed] = useState(!src);

  if (!src || failed) {
    return (
      <div
        aria-label={alt}
        className="absolute inset-0 flex items-center justify-center p-8 text-center"
        style={{
          background:
            "radial-gradient(circle at 50% 10%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 34%), linear-gradient(145deg, #111216, #050608)",
        }}
      >
        <div className="max-w-sm">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: "var(--primary)" }}>
            Ảnh demo đang được cập nhật
          </p>
          <p className="mt-4 text-2xl font-black leading-[1.2] tracking-tight text-white">{productName}</p>
          <p className="mt-3 text-sm font-normal leading-7 text-white/68">
            Khung xem trước vẫn được giữ để bố cục không bị vỡ khi ảnh chưa sẵn sàng.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      priority={priority}
      onError={() => setFailed(true)}
    />
  );
}
