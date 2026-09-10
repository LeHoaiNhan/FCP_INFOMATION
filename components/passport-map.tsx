"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as RPointerEvent, MouseEvent as RMouseEvent } from "react";
import {
  NATIONS,
  destinationsFor,
  passportName,
  passportFlag,
  flagSrc,
  DEFAULT_PASSPORT,
  type Destination,
} from "@/lib/visa";
import { TIERS, metaOf, type TierKey, type AnyTier } from "@/lib/tiers";
import Combobox, { type ComboOption } from "./combobox";

const BASE = { x: 0, y: 0, w: 1000, h: 480 };

export default function PassportMap() {
  const [passport, setPassport] = useState(DEFAULT_PASSPORT);
  const [selected, setSelected] = useState("IND");
  const [tierFilter, setTierFilter] = useState<TierKey | "">("");
  const [view, setView] = useState<"map" | "table">("map");
  /** true khi chọn một nước đến từ ô "Nước đến" → bản đồ chỉ sáng nước đó */
  const [focused, setFocused] = useState(false);

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

  /** Phóng bản đồ về khung bao của một nước (đọc toạ độ từ path d). */
  function zoomToCountry(d: string) {
    const nums = d.match(/-?\d*\.?\d+/g);
    if (!nums || nums.length < 4) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = +nums[i];
      const y = +nums[i + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    let w = (maxX - minX) * 2.4 + 16;
    let h = (maxY - minY) * 2.4 + 16;
    const aspect = BASE.w / BASE.h;
    if (w / h > aspect) h = w / aspect;
    else w = h * aspect;
    if (w >= BASE.w) {
      vb.current = { ...BASE };
    } else {
      vb.current = { x: cx - w / 2, y: cy - h / 2, w, h };
      clampVB();
    }
    applyVB();
  }

  function pickDestination(code: string) {
    setSelected(code);
    setFocused(true);
    setView("map");
    const d = byCode.get(code)?.d;
    if (d) zoomToCountry(d);
    else resetZoom();
  }

  function clearFocus() {
    setFocused(false);
    resetZoom();
  }

  function chooseDestination(code: string) {
    if (code) {
      pickDestination(code);
    } else {
      setSelected("");
      setFocused(false);
      resetZoom();
    }
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
    const fsrc = flagSrc(d.a2);
    const flag = fsrc
      ? `<img class="flag-img" src="${fsrc}" alt="" width="18" height="13">`
      : "";
    tip.innerHTML = `<div class="n">${flag}${d.name}</div>
      <div class="r"><span class="sw" style="background:var(${meta.v})"></span>${meta.label}${
        rich ? stay : ""
      }</div>${meta.note ? `<div class="note">${meta.note}</div>` : ""}`;

    const box = stage.getBoundingClientRect();
    const px = cx - box.left;
    const py = cy - box.top;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const M = 6;
    // canh giữa theo con trỏ, kẹp trong khung bản đồ
    let left = px - tw / 2;
    left = Math.max(M, Math.min(left, box.width - tw - M));
    // mặc định hiện phía trên con trỏ; không đủ chỗ thì lật xuống dưới
    let top = py - th - 14;
    if (top < M) top = py + 18;
    if (top + th > box.height - M) top = Math.max(M, box.height - th - M);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
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
    if (code && tierOf(code) !== "nodata") {
      setSelected(code);
      setFocused(false);
    }
  }

  // path list — dựng lại khi hộ chiếu / điểm chọn / bộ lọc đổi
  const paths = useMemo(
    () =>
      shaped.map((d) => {
        const meta = metaOf(d.tier);
        // Khi soi 1 nước: các nước khác về xám, không hiện màu mức.
        const focusBg = focused && d.code !== selected;
        const tierDim = !focusBg && !!tierFilter && d.tier !== tierFilter;
        const cls = [
          focusBg ? "t-focusbg" : meta.cls,
          d.tier !== "nodata" ? "hit" : "",
          tierDim ? "dim" : "",
          selected === d.code ? "sel" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <path key={d.code} d={d.d as string} className={cls} data-code={d.code} />
        );
      }),
    [shaped, selected, tierFilter, focused],
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
    return true;
  });

  const nationOptions: ComboOption[] = NATIONS.map((n) => ({
    value: n.code,
    label: n.name,
    flag: flagSrc(n.a2),
  }));
  const destOptions: ComboOption[] = [
    { value: "", label: "Tất cả các nước" },
    ...nationOptions,
  ];
  const visaOptions: ComboOption[] = [
    { value: "", label: "Tất cả loại visa", dot: "" },
    ...TIERS.map((t) => ({ value: t.k, label: t.label, dot: t.v })),
  ];

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
              làm trước chuyến đi. Bấm một nước trên bản đồ để xem chi tiết, hoặc
              chọn ở ô <strong>Nước đến</strong> để bản đồ soi riêng nước đó.
            </p>
          </div>
          <div className="passport">
            {passportFlag(passport) ? (
              <img
                className="flag-img flag-lg"
                src={passportFlag(passport) as string}
                alt=""
                width={30}
                height={22}
              />
            ) : (
              <span className="flag" aria-hidden="true">
                🛂
              </span>
            )}
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
        <Combobox
          label="Hộ chiếu"
          value={passport}
          options={nationOptions}
          onChange={setPassport}
          searchable
        />
        <Combobox
          label="Nước đến"
          value={selected}
          options={destOptions}
          onChange={chooseDestination}
          searchable
        />
        <Combobox
          label="Loại visa"
          value={tierFilter}
          options={visaOptions}
          onChange={(v) => setTierFilter(v as TierKey | "")}
        />

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
          {focused && (
            <button className="focus-clear" onClick={clearFocus}>
              ← Hiện tất cả các nước
            </button>
          )}
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
                      className={d.code === selected ? "row-sel" : undefined}
                      onClick={() => pickDestination(d.code)}
                    >
                      <td>
                        <span className="cell-nation">
                          {flagSrc(d.a2) && (
                            <img
                              className="flag-img"
                              src={flagSrc(d.a2) as string}
                              alt=""
                              width={20}
                              height={15}
                            />
                          )}
                          {d.name}
                        </span>
                      </td>
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
          {sel ? (
            <>
              <div className="verdict-head">
                <div>
                  <h2 className="verdict-name">
                    {flagSrc(sel.a2) && (
                      <img
                        className="flag-img flag-lg"
                        src={flagSrc(sel.a2) as string}
                        alt=""
                        width={28}
                        height={21}
                      />
                    )}
                    {sel.name}
                  </h2>
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
                    {sel.stay != null && <small>ngày</small>}
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
            </>
          ) : (
            <>
              <div className="verdict-head">
                <div>
                  <h2 className="verdict-name">Tất cả {total} nước</h2>
                  <div className="iso">HỘ CHIẾU {passport} → TỔNG QUAN</div>
                </div>
              </div>
              <p className="verdict-note">
                Chọn một nước ở ô <strong>Nước đến</strong> hoặc bấm thẳng trên
                bản đồ để xem mức thủ tục cụ thể cho hộ chiếu{" "}
                {passportName(passport)}.
              </p>
              <dl className="facts">
                <div className="fact">
                  <dt>Miễn thị thực</dt>
                  <dd>
                    {counts.free ?? 0}
                    <small>nước</small>
                  </dd>
                </div>
                <div className="fact">
                  <dt>Làm online</dt>
                  <dd>
                    {(counts.eta ?? 0) + (counts.evisa ?? 0)}
                    <small>nước</small>
                  </dd>
                </div>
                <div className="fact">
                  <dt>Visa tại ĐSQ</dt>
                  <dd>
                    {counts.visa ?? 0}
                    <small>nước</small>
                  </dd>
                </div>
              </dl>
            </>
          )}
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
