"use client";
import * as React from "react";
import Image from "next/image";
import { formatMoneyCents } from "@/lib/format";

export type OrderLine = {
  id: string;
  name: string;
  image: string;
  price: number; // cents
  qty: number;
};

type Props = {
  items: ReadonlyArray<OrderLine>;
  subtotal: number; // cents
  delivery: number; // cents
  total: number;    // cents
  eyebrow?: string;
};

export function OrderSummaryPanel({ items, subtotal, delivery, total, eyebrow = "Your order" }: Props) {
  return (
    <div className="relative h-full min-h-[280px] md:min-h-[640px] overflow-hidden bg-gradient-to-br from-ink to-[#2a1a16] text-bone">
      <div
        aria-hidden="true"
        className="absolute -right-12 -bottom-16 h-72 w-72 rounded-full bg-rouge/25 blur-3xl"
      />
      <div className="relative z-10 flex h-full flex-col justify-between p-6 md:p-12">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge mb-6">
            {eyebrow}
          </p>
          <ul className="flex flex-col gap-4">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-4">
                <div className="relative size-12 rounded-md overflow-hidden bg-bone/10 flex-shrink-0">
                  <Image
                    src={it.image}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base text-bone leading-tight tracking-tight truncate">
                    {it.name}
                  </p>
                  <p className="font-mono text-[11px] text-bone/60 mt-0.5">
                    {it.qty} × {formatMoneyCents(it.price, "en")}
                  </p>
                </div>
                <span className="font-mono text-sm text-bone/85 flex-shrink-0">
                  {formatMoneyCents(it.price * it.qty, "en")}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-8 border-t border-bone/15 pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/60">
              Subtotal
            </span>
            <span className="font-mono text-sm text-bone/85">
              {formatMoneyCents(subtotal, "en")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/60">
              Delivery
            </span>
            <span className="font-mono text-sm text-bone/85">
              {formatMoneyCents(delivery, "en")}
            </span>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-bone/10">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/70">
              Total
            </span>
            <span className="font-display text-2xl tracking-tighter">
              {formatMoneyCents(total, "en")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
