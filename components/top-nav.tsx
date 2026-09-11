"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/", label: "Bản đồ", icon: "🗺️" },
  { href: "/ho-chieu", label: "Bộ sưu tập hộ chiếu", icon: "🛂" },
];

/**
 * Không có thanh header — chỉ một icon lưới 9 chấm nổi ở góc phải trên
 * (kiểu Google Maps), bấm vào hiện bảng menu điều hướng.
 */
export default function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="appgrid" ref={wrapRef}>
      <button
        type="button"
        className="appgrid-btn"
        aria-label="Menu ứng dụng"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="appgrid-dots" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <i key={i} />
          ))}
        </span>
      </button>
      {open && (
        <div className="appgrid-panel" role="menu">
          <Link href="/" className="appgrid-brand" onClick={() => setOpen(false)}>
            🛂 Hộ chiếu đi đâu?
          </Link>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="appgrid-item"
              role="menuitem"
              aria-current={pathname === l.href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <span className="appgrid-item-icon" aria-hidden="true">
                {l.icon}
              </span>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
