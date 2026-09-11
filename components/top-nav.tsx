"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Bản đồ" },
  { href: "/ho-chieu", label: "Bộ sưu tập hộ chiếu" },
];

export default function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="topnav">
      <div className="topnav-inner">
        <span className="topnav-brand">🛂 Hộ chiếu đi đâu?</span>
        <div className="topnav-links">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="topnav-link"
              aria-current={pathname === l.href ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
