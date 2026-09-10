"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as RPointerEvent, MouseEvent as RMouseEvent } from "react";
import type { Country } from "@/lib/countries";
import { TIERS, ORDER, metaOf, type TierKey, type AnyTier } from "@/lib/tiers";

const BASE = { x: 0, y: 0, w: 1000, h: 480 };

export default function PassportMap({ countries }: { countries: Country[] }) {
  const byName = useMemo(
    () => new Map(countries.map((c) => [c.name, c])),
    [countries],
  );
  const tierOf = (name: string): AnyTier => byName.get(name)?.tier ?? "nodata";

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const co of countries) c[co.tier] = (c[co.tier] ?? 0) + 1;
    return c;
  }, [countries]);

  const rows = useMemo(
    () =>
      countries
        .filter((c) => c.tier !== "nodata" && c.tier !== "home")
        .sort(
          (a, b) =>
            (ORDER[a.tier] ?? 0) - (ORDER[b.tier] ?? 0) ||
            a.name.localeCompare(b.name),
        ),
    [countries],
  );

  const [selected, setSelected] = useState("India");
  const [filter, setFilter] = useState<TierKey | null>(null);
  const [view, setView] = useState<"map" | "table">("map");
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const svgRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const vb = useRef({ ...BASE });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(
    null,
  );
  const moved = useRef(0);

  const applyVB = () => {
    const v = vb.current;
    svgRef.current?.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
  };
  useEffect(applyVB, []);

  function clampVB() {
    const v = vb.current;
    v.x = Math.max(
      BASE.x - v.w * 0.15,
      Math.min(BASE.w - v.w + v.w * 0.15, v.x),
    );
    v.y = Math.max(
      BASE.y - v.h * 0.15,
      Math.min(BASE.h - v.h + v.h * 0.15, v.y),
    );
  }

  function zoom(f: number) {
    const v = vb.current;
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    const w = Math.min(BASE.w, Math.max(BASE.w / 12, v.w * f));
    const h = (w * BASE.h) / BASE.w;
    vb.current = { w, h, x: cx - w / 2, y: cy - h / 2 };
    clampVB();
    applyVB();
  }
  function resetZoom() {
    vb.current = { ...BASE };
    applyVB();
  }

  function pathNameAt(target: EventTarget): string | null {
    const el = (target as Element)?.closest?.("path");
    return el?.getAttribute("data-name") ?? null;
  }

  function showTip(name: string, cx: number, cy: number) {
    const tip = tipRef.current;
    const stage = stageRef.current;
    if (!tip || !stage) return;
    const t = tierOf(name);
    const meta = metaOf(t);
    const co = byName.get(name);
    const stay = co?.stay ? `${co.stay} ngày` : "—";
    const rich = t !== "nodata" && t !== "home";
    tip.innerHTML = `<div class="n">${name}</div>
      <div class="r"><span class="sw" style="background:var(${meta.v})"></span>${meta.label}${
        rich ? ` · ${stay}` : ""
      }</div>`;
    const box = stage.getBoundingClientRect();
    tip.style.left = `${cx - box.left}px`;
    tip.style.top = `${cy - box.top}px`;
    tip.classList.add("on");
  }
  function hideTip() {
    tipRef.current?.classList.remove("on");
  }

  function onPointerDown(e: RPointerEvent<SVGSVGElement>) {
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      vx: vb.current.x,
      vy: vb.current.y,
    };
    moved.current = 0;
    svgRef.current?.classList.add("dragging");
    svgRef.current?.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: RPointerEvent<SVGSVGElement>) {
    if (!drag.current) {
      const name = pathNameAt(e.target);
      if (name) showTip(name, e.clientX, e.clientY);
      else hideTip();
      return;
    }
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const d = drag.current;
    const dx = ((e.clientX - d.x) * vb.current.w) / r.width;
    const dy = ((e.clientY - d.y) * vb.current.h) / r.height;
    moved.current = Math.max(
      moved.current,
      Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y),
    );
    vb.current.x = d.vx - dx;
    vb.current.y = d.vy - dy;
    clampVB();
    applyVB();
  }
  function endDrag() {
    drag.current = null;
    svgRef.current?.classList.remove("dragging");
  }
  function onClick(e: RMouseEvent<SVGSVGElement>) {
    if (moved.current > 5) return;
    const name = pathNameAt(e.target);
    if (name && tierOf(name) !== "nodata") setSelected(name);
  }

  function toggleFilter(k: TierKey) {
    setFilter((cur) => (cur === k ? null : k));
  }

  function pickCountry(name: string) {
    setSelected(name);
    setView("map");
  }

  // Các path chỉ dựng lại khi countries / selected / filter đổi.
  const paths = useMemo(
    () =>
      countries.map((c) => {
        const meta = metaOf(c.tier);
        const cls = [
          meta.cls,
          c.tier !== "nodata" ? "hit" : "",
          filter && c.tier !== filter ? "dim" : "",
          selected === c.name ? "sel" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <path key={c.id + c.name} d={c.d} className={cls} data-name={c.name} />
        );
      }),
    [countries, selected, filter],
  );

  const sel = byName.get(selected);
  const selTier: AnyTier = sel?.tier ?? "nodata";
  const selMeta = metaOf(selTier);

  const fee =
    sel?.fee == null ? "—" : sel.fee === 0 ? "Miễn phí" : String(sel.fee);
  const stay = sel?.stay == null ? "—" : String(sel.stay);
  const proc = sel?.processing == null ? "—" : String(sel.processing);

  const total = rows.length;
  const noPaper =
    (counts.free ?? 0) +
    (counts.eta ?? 0) +
    (counts.evisa ?? 0) +
    (counts.voa ?? 0);
  const pct = total ? Math.round((noPaper / total) * 100) : 0;

  const tableRows = rows.filter(
    (c) =>
      !query.trim() ||
      c.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const mrz = mounted
    ? (() => {
        const pad = (s: string, n: number) =>
          (s + "<".repeat(n)).slice(0, n);
        const date = new Date()
          .toISOString()
          .slice(2, 10)
          .replace(/-/g, "");
        return (
          "P<VNMBAN<DO<THI<THUC<<DU<LIEU<MAU<<<<<<<<<<<<\n" +
          pad(`0000000000VNM${date}M`, 30) +
          `${total}QUOCGIA<${TIERS.length}MUC<<`
        );
      })()
    : " ";

  return (
    <div className="wrap">
      <header>
        <div className="head-top">
          <div>
            <div className="eyebrow">
              Bản đồ chính sách nhập cảnh · {countries.length} quốc gia &amp;
              vùng lãnh thổ
            </div>
            <h1>Hộ chiếu Việt Nam đi đâu?</h1>
            <p className="sub">
              Mỗi quốc gia được tô theo <strong>mức thủ tục</strong> bạn phải làm
              trước chuyến đi — từ miễn thị thực đến phải xin visa tại đại sứ
              quán. Bấm vào một nước để xem chi tiết.
            </p>
          </div>
          <div className="passport">
            <span className="flag" aria-hidden="true">
              🇻🇳
            </span>
            <span>
              <span className="code">P&lt;VNM</span>
              <span className="cap">Hộ chiếu phổ thông</span>
            </span>
          </div>
        </div>

        <div className="notice">
          <span className="icn" aria-hidden="true">
            [!]
          </span>
          <span>
            <b>Đây là dữ liệu mẫu để minh hoạ giao diện.</b> Các con số phí, thời
            hạn lưu trú và thời gian xử lý chưa được đối chiếu với nguồn chính
            thức và <b>không dùng để ra quyết định đi lại</b>. Bản chạy thật cần
            gắn <span className="mono">officialUrl</span> +{" "}
            <span className="mono">lastVerified</span> cho từng dòng.
          </span>
        </div>
      </header>

      <div className="toolbar">
        <div className="search">
          <span className="mag" aria-hidden="true">
            ⌕
          </span>
          <input
            id="q"
            type="search"
            placeholder="Tìm quốc gia…"
            autoComplete="off"
            list="countries"
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              const hit = rows.find(
                (c) => c.name.toLowerCase() === v.trim().toLowerCase(),
              );
              if (hit) setSelected(hit.name);
            }}
          />
          <datalist id="countries">
            {rows.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <div className="seg" role="group" aria-label="Chế độ xem">
          <button
            aria-pressed={view === "map"}
            onClick={() => setView("map")}
          >
            Bản đồ
          </button>
          <button
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            Bảng
          </button>
        </div>
      </div>

      <div className="mapcard" hidden={view !== "map"}>
        <div className="mapstage" ref={stageRef}>
          <svg
            ref={svgRef}
            className="map"
            viewBox="0 0 1000 480"
            role="img"
            aria-label="Bản đồ thế giới tô màu theo mức thủ tục nhập cảnh đối với hộ chiếu Việt Nam. Bảng dữ liệu tương đương có ở chế độ xem Bảng."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={hideTip}
            onClick={onClick}
          >
            {paths}
          </svg>
          <div className="tip" ref={tipRef} aria-hidden="true" />
          <div className="zoom">
            <button
              title="Phóng to"
              aria-label="Phóng to"
              onClick={() => zoom(1 / 1.5)}
            >
              +
            </button>
            <button
              title="Thu nhỏ"
              aria-label="Thu nhỏ"
              onClick={() => zoom(1.5)}
            >
              −
            </button>
            <button
              title="Về mặc định"
              aria-label="Về mặc định"
              onClick={resetZoom}
            >
              ⌂
            </button>
          </div>
        </div>
      </div>

      <div className="legend">
        <div className="legend-scale">
          <span>← Ít thủ tục hơn</span>
          <span className="eyebrow">Thang thứ bậc · bấm để lọc</span>
          <span>Nhiều thủ tục hơn →</span>
        </div>
        <div className="tiers">
          {TIERS.map((t) => (
            <button
              key={t.k}
              className={`tier ${t.bar}${filter && filter !== t.k ? " off" : ""}`}
              aria-pressed={filter === t.k}
              onClick={() => toggleFilter(t.k)}
            >
              <span className="bar" />
              <span className="lbl">{t.label}</span>
              <span className="cnt">
                {counts[t.k] ?? 0}
                <em>nước</em>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mapcard" hidden={view !== "table"}>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Quốc gia</th>
                <th scope="col">Mức thủ tục</th>
                <th scope="col">Lưu trú</th>
                <th scope="col">Phí</th>
                <th scope="col">Xử lý</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: "var(--muted)" }}>
                    Không tìm thấy quốc gia nào khớp.
                  </td>
                </tr>
              ) : (
                tableRows.map((c) => {
                  const m = metaOf(c.tier);
                  return (
                    <tr key={c.id} onClick={() => pickCountry(c.name)}>
                      <td>{c.name}</td>
                      <td>
                        <span className="pill">
                          <span
                            className="sw"
                            style={{ background: `var(${m.v})` }}
                          />
                          {m.short ?? m.label}
                        </span>
                      </td>
                      <td className="num">{c.stay ?? "—"}</td>
                      <td className="num">
                        {c.fee == null
                          ? "—"
                          : c.fee === 0
                            ? "miễn phí"
                            : `$${c.fee}`}
                      </td>
                      <td className="num">{c.processing ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lower">
        <div className="panel insights">
          <h3>Bản đồ này nói lên điều gì</h3>
          <ul className="ins">
            <li>
              <span className="num">{counts.free ?? 0}</span>
              <p>
                <b>Miễn thị thực hoàn toàn.</b> Gần như toàn bộ nằm trong ASEAN —
                vùng xanh nhạt duy nhất trên bản đồ tập trung quanh Đông Nam Á.
              </p>
            </li>
            <li>
              <span className="num">{counts.eta ?? 0}</span>
              <p>
                <b>Chỉ {counts.eta ?? 0} nơi dùng eTA</b> với hộ chiếu Việt Nam.
                Đây là điểm hay bị nhầm nhất: eTA không phải visa, nó là{" "}
                <em>cấp phép đi lại</em> và phần lớn quốc gia chỉ mở cho các hộ
                chiếu vốn đã được miễn thị thực.
              </p>
            </li>
            <li>
              <span className="num">{counts.evisa ?? 0}</span>
              <p>
                <b>Xin eVisa online.</b> Dải này trải khắp châu Phi, Trung Á và
                Nam Á — nộp hồ sơ qua web, nhận file PDF, không cần đến đại sứ
                quán.
              </p>
            </li>
            <li>
              <span className="num">{pct}%</span>
              <p>
                <b>Số điểm đến làm được thủ tục không cần đến đại sứ quán</b>,
                tính cả bốn mức đầu. Phần còn lại — mảng xanh đậm phủ châu Âu, Bắc
                Mỹ và Đông Á — vẫn phải nộp hồ sơ trực tiếp.
              </p>
            </li>
          </ul>
        </div>

        <div className="panel verdict">
          <div className="verdict-head">
            <div>
              <h2>{selected}</h2>
              <div className="iso">ĐIỂM ĐẾN · TỪ P&lt;VNM</div>
            </div>
            <span className="badge">
              <span
                className="sw"
                style={{ background: `var(${selMeta.v})` }}
              />
              {selMeta.label}
            </span>
          </div>
          <dl className="facts">
            <div className="fact">
              <dt>Lưu trú tối đa</dt>
              <dd>
                {stay}
                {sel?.stay != null && <small>ngày</small>}
              </dd>
            </div>
            <div className="fact">
              <dt>Lệ phí</dt>
              <dd>
                {fee}
                {sel?.fee != null && sel.fee > 0 && <small>USD</small>}
              </dd>
            </div>
            <div className="fact">
              <dt>Thời gian xử lý</dt>
              <dd>
                {proc}
                {sel?.processing != null && <small>ngày làm việc</small>}
              </dd>
            </div>
          </dl>
          <div className="src">
            <span>
              Nguồn chính thức:{" "}
              {sel?.officialUrl ? (
                <a href={sel.officialUrl} target="_blank" rel="noreferrer">
                  cổng cấp phép
                </a>
              ) : (
                <span className="mono">chưa gắn</span>
              )}
            </span>
            <span>
              Kiểm chứng lần cuối:{" "}
              <span className="mono">{sel?.lastVerified ?? "—"}</span>
            </span>
          </div>
        </div>
      </div>

      <footer>
        <div className="mrz">{mrz}</div>
        <p className="foot-note">
          Phép chiếu <strong>Equal Earth</strong> — bảo toàn tỷ lệ diện tích, nên
          một nước lớn trên hình đúng là một nước lớn (khác với Mercator vốn thổi
          phồng vùng gần cực). Thang màu dùng{" "}
          <strong>một tông xanh, đậm dần theo mức thủ tục</strong>: vì thứ bậc
          được mã hoá bằng độ sáng chứ không bằng sắc màu, bản đồ vẫn đọc được với
          người mù màu và khi in đen trắng. Nam Cực được lược bỏ. Ở độ phân giải
          110m này, các quốc gia siêu nhỏ (Singapore, Bahrain, Maldives, Malta…)
          không có hình đa giác — bản chạy thật cần dùng hình học 50m kèm điểm
          đánh dấu cho nhóm đó.
        </p>
      </footer>
    </div>
  );
}
