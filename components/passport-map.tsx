"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as RPointerEvent, MouseEvent as RMouseEvent } from "react";
import {
  NATIONS,
  destinationsFor,
  passportName,
  DEFAULT_PASSPORT,
  type Destination,
} from "@/lib/visa";
import { TIERS, metaOf, type TierKey, type AnyTier } from "@/lib/tiers";

const BASE = { x: 0, y: 0, w: 1000, h: 480 };

export default function PassportMap() {
  const [passport, setPassport] = useState(DEFAULT_PASSPORT);
  const [selected, setSelected] = useState("IND");
  const [tierFilter, setTierFilter] = useState<TierKey | "">("");
  const [view, setView] = useState<"map" | "table">("map");
  const [query, setQuery] = useState("");

  const destinations = useMemo(() => destinationsFor(passport), [passport]);
  const byCode = useMemo(
    () => new Map(destinations.map((d) => [d.code, d])),
    [destinations],
  );
  const shaped = useMemo(
    () => destinations.filter((d) => d.d !== null),
    [destinations],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of destinations) {
      if (d.tier === "home") continue;
      c[d.tier] = (c[d.tier] ?? 0) + 1;
    }
    return c;
  }, [destinations]);

  const tierOf = (code: string): AnyTier => byCode.get(code)?.tier ?? "nodata";

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
    v.x = Math.max(BASE.x - v.w * 0.15, Math.min(BASE.w - v.w + v.w * 0.15, v.x));
    v.y = Math.max(BASE.y - v.h * 0.15, Math.min(BASE.h - v.h + v.h * 0.15, v.y));
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

  function codeAt(target: EventTarget): string | null {
    const el = (target as Element)?.closest?.("path");
    return el?.getAttribute("data-code") ?? null;
  }

  function showTip(code: string, cx: number, cy: number) {
    const tip = tipRef.current;
    const stage = stageRef.current;
    if (!tip || !stage) return;
    const d = byCode.get(code);
    if (!d) return;
    const meta = metaOf(d.tier);
    const rich = d.tier !== "nodata" && d.tier !== "home";
    const stay = d.stay ? ` · ${d.stay} ngày` : "";
    tip.innerHTML = `<div class="n">${d.name}</div>
      <div class="r"><span class="sw" style="background:var(${meta.v})"></span>${meta.label}${
        rich ? stay : ""
      }</div>${meta.note ? `<div class="note">${meta.note}</div>` : ""}`;
    const box = stage.getBoundingClientRect();
    tip.style.left = `${cx - box.left}px`;
    tip.style.top = `${cy - box.top}px`;
    tip.classList.add("on");
  }
  const hideTip = () => tipRef.current?.classList.remove("on");

  function onPointerDown(e: RPointerEvent<SVGSVGElement>) {
    drag.current = { x: e.clientX, y: e.clientY, vx: vb.current.x, vy: vb.current.y };
    moved.current = 0;
    svgRef.current?.classList.add("dragging");
    svgRef.current?.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: RPointerEvent<SVGSVGElement>) {
    if (!drag.current) {
      const code = codeAt(e.target);
      if (code) showTip(code, e.clientX, e.clientY);
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
  const endDrag = () => {
    drag.current = null;
    svgRef.current?.classList.remove("dragging");
  };
  function onClick(e: RMouseEvent<SVGSVGElement>) {
    if (moved.current > 5) return;
    const code = codeAt(e.target);
    if (code && tierOf(code) !== "nodata") setSelected(code);
  }

  // path list — dựng lại khi hộ chiếu / điểm chọn / bộ lọc đổi
  const paths = useMemo(
    () =>
      shaped.map((d) => {
        const meta = metaOf(d.tier);
        const cls = [
          meta.cls,
          d.tier !== "nodata" ? "hit" : "",
          tierFilter && d.tier !== tierFilter ? "dim" : "",
          selected === d.code ? "sel" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <path key={d.code} d={d.d as string} className={cls} data-code={d.code} />
        );
      }),
    [shaped, selected, tierFilter],
  );

  const sel: Destination | undefined = byCode.get(selected);
  const selMeta = metaOf(sel?.tier ?? "nodata");
  const stay = sel?.stay == null ? "—" : String(sel.stay);

  const total = destinations.filter(
    (d) => d.tier !== "home" && d.tier !== "nodata",
  ).length;
  const noPaper =
    (counts.free ?? 0) + (counts.eta ?? 0) + (counts.evisa ?? 0) + (counts.voa ?? 0);
  const pct = total ? Math.round((noPaper / total) * 100) : 0;

  const tableRows = destinations.filter((d) => {
    if (d.tier === "home") return false;
    if (tierFilter && d.tier !== tierFilter) return false;
    const q = query.trim().toLowerCase();
    return !q || d.name.toLowerCase().includes(q);
  });

  const mrz = (() => {
    const pad = (s: string, n: number) => (s + "<".repeat(n)).slice(0, n);
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const nm = passportName(passport).toUpperCase().replace(/[^A-Z]+/g, "<");
    return (
      `P<${passport}${nm}${"<".repeat(44)}`.slice(0, 44) +
      "\n" +
      pad(`0000000000${passport}${date}M`, 30) +
      `${total}DIEMDEN<${TIERS.length}MUC<<`
    );
  })();

  return (
    <div className="wrap">
      <header>
        <div className="head-top">
          <div>
            <div className="eyebrow">
              Bản đồ chính sách nhập cảnh · {NATIONS.length} hộ chiếu ×{" "}
              {NATIONS.length} điểm đến
            </div>
            <h1>Hộ chiếu {passportName(passport)} đi đâu?</h1>
            <p className="sub">
              Mỗi nước được tô theo <strong>mức thủ tục</strong> hộ chiếu này phải
              làm trước chuyến đi — từ miễn thị thực đến phải xin visa tại đại sứ
              quán. Đổi hộ chiếu ở thanh công cụ; bấm một nước để xem chi tiết.
            </p>
          </div>
          <div className="passport">
            <span className="flag" aria-hidden="true">
              🛂
            </span>
            <span>
              <span className="code">P&lt;{passport}</span>
              <span className="cap">{passportName(passport)}</span>
            </span>
          </div>
        </div>

        <div className="notice">
          <span className="icn" aria-hidden="true">
            [i]
          </span>
          <span>
            Nguồn: <b>Passport Index Dataset</b> (ilyankou, giấy phép MIT) — tổng
            hợp thông tin công khai, cập nhật vài lần mỗi năm,{" "}
            <b>không phải real-time</b>. Lệ phí và thời gian xử lý dataset không
            có. Bản chạy thật cần gắn <span className="mono">officialUrl</span> +{" "}
            <span className="mono">lastVerified</span> cho từng dòng và đối chiếu
            cổng chính thức của nước đến.
          </span>
        </div>
      </header>

      <div className="toolbar">
        <label className="field">
          <span className="field-lbl">Hộ chiếu</span>
          <select
            value={passport}
            onChange={(e) => setPassport(e.target.value)}
          >
            {NATIONS.map((n) => (
              <option key={n.code} value={n.code}>
                {n.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-lbl">Nước đến</span>
          <div className="search">
            <span className="mag" aria-hidden="true">
              ⌕
            </span>
            <input
              type="search"
              placeholder="Tìm nước đến…"
              aria-label="Tìm nước đến"
              autoComplete="off"
              list="destinations"
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                const hit = destinations.find(
                  (d) => d.name.toLowerCase() === v.trim().toLowerCase(),
                );
                if (hit) setSelected(hit.code);
              }}
            />
            <datalist id="destinations">
              {destinations
                .filter((d) => d.tier !== "home")
                .map((d) => (
                  <option key={d.code} value={d.name} />
                ))}
            </datalist>
          </div>
        </label>

        <label className="field">
          <span className="field-lbl">Loại visa</span>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as TierKey | "")}
          >
            <option value="">Tất cả</option>
            {TIERS.map((t) => (
              <option key={t.k} value={t.k}>
                {t.short}
              </option>
            ))}
          </select>
        </label>

        <div className="seg" role="group" aria-label="Chế độ xem">
          <button aria-pressed={view === "map"} onClick={() => setView("map")}>
            Bản đồ
          </button>
          <button aria-pressed={view === "table"} onClick={() => setView("table")}>
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
            aria-label={`Bản đồ thế giới tô màu theo mức thủ tục nhập cảnh đối với hộ chiếu ${passportName(
              passport,
            )}. Bảng dữ liệu tương đương có ở chế độ xem Bảng.`}
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
            <button title="Phóng to" aria-label="Phóng to" onClick={() => zoom(1 / 1.5)}>
              +
            </button>
            <button title="Thu nhỏ" aria-label="Thu nhỏ" onClick={() => zoom(1.5)}>
              −
            </button>
            <button title="Về mặc định" aria-label="Về mặc định" onClick={resetZoom}>
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
              className={`tier ${t.bar}${tierFilter && tierFilter !== t.k ? " off" : ""}`}
              aria-pressed={tierFilter === t.k}
              onClick={() => setTierFilter((cur) => (cur === t.k ? "" : t.k))}
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
                <th scope="col">Nước đến</th>
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
                    Không có nước nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                tableRows.map((d) => {
                  const m = metaOf(d.tier);
                  return (
                    <tr
                      key={d.code}
                      onClick={() => {
                        setSelected(d.code);
                        setView("map");
                      }}
                    >
                      <td>{d.name}</td>
                      <td>
                        <span className="pill">
                          <span className="sw" style={{ background: `var(${m.v})` }} />
                          {m.short}
                        </span>
                      </td>
                      <td className="num">{d.stay ?? "—"}</td>
                      <td className="num">—</td>
                      <td className="num">—</td>
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
                <b>Nước miễn thị thực</b> cho hộ chiếu {passportName(passport)} —
                vào thẳng, không giấy tờ xin trước.
              </p>
            </li>
            <li>
              <span className="num">{counts.evisa ?? 0}</span>
              <p>
                <b>Nước cấp eVisa online.</b> Nộp hồ sơ qua web, nhận file PDF,
                không cần đến đại sứ quán.
              </p>
            </li>
            <li>
              <span className="num">{counts.visa ?? 0}</span>
              <p>
                <b>Nước phải xin visa tại đại sứ quán</b> — nộp hồ sơ giấy trực
                tiếp, chờ 1–4 tuần rồi mới bay được.
              </p>
            </li>
            <li>
              <span className="num">{pct}%</span>
              <p>
                <b>Điểm đến làm được thủ tục không cần đến đại sứ quán</b> — tính
                cả miễn thị thực, eTA, eVisa và cấp tại cửa khẩu.
              </p>
            </li>
          </ul>
        </div>

        <div className="panel verdict">
          <div className="verdict-head">
            <div>
              <h2>{sel?.name ?? "—"}</h2>
              <div className="iso">
                HỘ CHIẾU {passport} → {selected}
              </div>
            </div>
            <span className="badge">
              <span className="sw" style={{ background: `var(${selMeta.v})` }} />
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
                —<small>không có trong dataset</small>
              </dd>
            </div>
            <div className="fact">
              <dt>Thời gian xử lý</dt>
              <dd>
                —<small>không có trong dataset</small>
              </dd>
            </div>
          </dl>
          {selMeta.note && <p className="verdict-note">{selMeta.note}.</p>}
          <div className="src">
            <span>
              Nguồn chính thức: <span className="mono">chưa gắn</span>
            </span>
            <span>
              Kiểm chứng lần cuối: <span className="mono">—</span>
            </span>
          </div>
        </div>
      </div>

      <footer>
        <div className="mrz" suppressHydrationWarning>
          {mrz}
        </div>
        <p className="foot-note">
          Phép chiếu <strong>Equal Earth</strong> — bảo toàn tỷ lệ diện tích. Thang
          màu đi từ <strong>xanh lá</strong> (ít thủ tục) qua xanh dương, cam, tới{" "}
          <strong>đỏ</strong> (visa tại đại sứ quán). Vì có người khó phân biệt
          xanh–đỏ, mỗi mức còn khác nhau về độ sáng và luôn kèm nhãn chữ ở chú
          giải, khi rê chuột và trong bảng. Ở độ phân giải 110m, các nước siêu nhỏ
          (Singapore, Bahrain, Maldives, Malta…) không có hình đa giác — vẫn có
          trong bảng và ô tìm kiếm.
        </p>
      </footer>
    </div>
  );
}
