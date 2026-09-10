"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as RKeyboardEvent } from "react";

export interface ComboOption {
  value: string;
  label: string;
  /** src ảnh cờ */
  flag?: string | null;
  /** tên biến CSS cho chấm màu, vd "--t1" */
  dot?: string;
}

export default function Combobox({
  label,
  value,
  options,
  onChange,
  searchable = false,
  placeholder = "Chọn…",
}: {
  label: string;
  value: string;
  options: ComboOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const current = options.find((o) => o.value === value);
  const needle = q.trim().toLowerCase();
  const filtered =
    searchable && needle
      ? options.filter((o) => o.label.toLowerCase().includes(needle))
      : options;
  const hasIcon = options.some((o) => o.flag || o.dot !== undefined);

  function openPanel() {
    const i = options.findIndex((o) => o.value === value);
    setActive(i < 0 ? 0 : i);
    setQ("");
    setOpen(true);
  }
  function closePanel() {
    setOpen(false);
    setQ("");
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closePanel();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open && searchable) inputRef.current?.focus();
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    (listRef.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({
      block: "nearest",
    });
  }, [active, open]);

  function pick(v: string) {
    onChange(v);
    closePanel();
  }

  function onKey(e: RKeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active].value);
    } else if (e.key === "Escape") {
      closePanel();
    }
  }

  const icon = (o: ComboOption) => {
    if (o.flag) return <img className="flag-img" src={o.flag} alt="" width={20} height={15} />;
    if (o.dot !== undefined)
      return (
        <span
          className="combo-dot"
          style={
            o.dot
              ? { background: `var(${o.dot})`, borderColor: "transparent" }
              : { background: "transparent" }
          }
        />
      );
    if (hasIcon) return <span className="combo-dot combo-dot--ghost" />;
    return null;
  };

  return (
    <div className="field combo" ref={rootRef}>
      <span className="field-lbl" id={`${id}-lbl`}>
        {label}
      </span>
      <button
        type="button"
        className="combo-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-lbl`}
        onClick={() => (open ? closePanel() : openPanel())}
      >
        {current && icon(current)}
        <span className="combo-val">{current?.label ?? placeholder}</span>
        <span className="combo-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="combo-panel">
          {searchable && (
            <input
              ref={inputRef}
              className="combo-search"
              type="text"
              placeholder="Gõ để tìm…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
            />
          )}
          <ul className="combo-list" role="listbox" ref={listRef} onKeyDown={onKey}>
            {filtered.length === 0 && <li className="combo-empty">Không có kết quả</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value || "_all"}
                role="option"
                aria-selected={o.value === value}
                className={`combo-opt${i === active ? " active" : ""}${
                  o.value === value ? " sel" : ""
                }`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.value)}
              >
                {icon(o)}
                <span>{o.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
