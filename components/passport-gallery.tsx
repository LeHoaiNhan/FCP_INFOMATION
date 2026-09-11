"use client";

import { useMemo, useRef, useState } from "react";
import {
  NATIONS,
  DEFAULT_PASSPORT,
  PASSPORT_COVERS,
  passportCoverSrc,
  flagSrc,
} from "@/lib/visa";
import { TIERS } from "@/lib/tiers";
import Combobox, { type ComboOption } from "./combobox";
import PassportMap from "./passport-map";

export default function PassportGallery() {
  const [passport, setPassport] = useState(DEFAULT_PASSPORT);
  const [q, setQ] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);

  const covered = useMemo(
    () =>
      NATIONS.filter((n) => PASSPORT_COVERS.has(n.code)).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [],
  );
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? covered.filter((n) => n.name.toLowerCase().includes(needle))
    : covered;

  function choose(code: string) {
    setPassport(code);
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const allOptions: ComboOption[] = NATIONS.map((n) => ({
    value: n.code,
    label: n.name,
    flag: flagSrc(n.a2),
  }));

  return (
    <>
    <div className="wrap gallery-wrap">
      <header>
        <div className="head-top">
          <div>
            <div className="eyebrow">Bộ sưu tập hộ chiếu · {NATIONS.length} nước</div>
            <h1>Hộ chiếu là gì, và vì sao mỗi hộ chiếu &quot;đi&quot; được khác nhau?</h1>
            <p className="sub">
              Hộ chiếu là giấy tờ nhà nước cấp để công dân xuất — nhập cảnh nước
              khác. Nước bạn đến cho hộ chiếu của bạn miễn thị thực hay bắt xin
              trước tuỳ vào <strong>hiệp định song phương</strong> giữa hai
              nước — không phải hộ chiếu nào cũng như nhau. Chọn một tấm bìa hộ
              chiếu bên dưới để xem hộ chiếu đó đi được những đâu.
            </p>
          </div>
        </div>
      </header>

      <section className="panel">
        <h3 style={{ marginBottom: 12 }}>5 mức thủ tục nhập cảnh</h3>
        <div className="tierinfo-grid">
          {TIERS.map((t) => (
            <div className="tierinfo-card" key={t.k}>
              <span className="bar" style={{ background: `var(${t.v})` }} />
              <div className="lbl">{t.label}</div>
              {t.note && <p>{t.note}.</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="gallery-section">
        <div className="gallery-head">
          <h3>Chọn hộ chiếu của bạn</h3>
          <input
            className="combo-search gallery-search"
            type="text"
            placeholder="Gõ tên nước…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="cover-grid">
          {shown.map((n) => (
            <button
              key={n.code}
              className={`cover-card${n.code === passport ? " sel" : ""}`}
              onClick={() => choose(n.code)}
              aria-pressed={n.code === passport}
            >
              <img
                src={passportCoverSrc(n.code, "thumb") as string}
                alt={`Bìa hộ chiếu ${n.name}`}
                loading="lazy"
                width={112}
                height={160}
              />
              <span className="cover-lbl">
                {flagSrc(n.a2) && (
                  <img className="flag-img" src={flagSrc(n.a2) as string} alt="" width={16} height={12} />
                )}
                {n.name}
              </span>
            </button>
          ))}
          {shown.length === 0 && (
            <p className="combo-empty">Không có nước nào khớp &quot;{q}&quot;.</p>
          )}
        </div>

        <p className="gallery-fallback">
          Chưa có ảnh bìa cho hộ chiếu bạn cần? Chọn trong danh sách đầy đủ{" "}
          {NATIONS.length} nước:
        </p>
        <Combobox
          label="Hộ chiếu khác"
          value={passport}
          options={allOptions}
          onChange={choose}
          searchable
        />
      </section>
    </div>

    <div ref={mapRef}>
      <PassportMap passport={passport} onPassportChange={setPassport} />
    </div>
    </>
  );
}
