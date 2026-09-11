"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as RPointerEvent, MouseEvent as RMouseEvent } from "react";
import {
  NATIONS,
  destinationsFor,
  originsFor,
  passportName,
  passportFlag,
  flagSrc,
  DEFAULT_PASSPORT,
  type Destination,
} from "@/lib/visa";
import { TIERS, metaOf, type TierKey, type AnyTier } from "@/lib/tiers";
import Combobox, { type ComboOption } from "./combobox";

const BASE = { x: 0, y: 0, w: 1000, h: 480 };

interface PassportMapProps {
  /** Hộ chiếu do trang cha điều khiển (vd trang gallery) — bỏ trống để tự quản lý state. */
  passport?: string;
  onPassportChange?: (code: string) => void;
}

export default function PassportMap({
  passport: passportProp,
  onPassportChange,
}: PassportMapProps = {}) {
  const [internalPassport, setInternalPassport] = useState(DEFAULT_PASSPORT);
  const passport = passportProp ?? internalPassport;
  const setPassport = onPassportChange ?? setInternalPassport;
  /** mã nước đến đang xem chi tiết; "" = tất cả các nước */
  const [selected, setSelected] = useState("");
  const [tierFilter, setTierFilter] = useState<TierKey | "">("");
  const [view, setView] = useState<"map" | "table">("map");
  /** true khi chọn một nước đến từ ô "Nước đến" → bản đồ chỉ sáng nước đó */
  const [focused, setFocused] = useState(false);
  /** thang thứ bậc (chú giải) đang mở hay thu gọn */
  const [legendOpen, setLegendOpen] = useState(true);
  /** đang chờ kết quả định vị GPS → nước */
  const [locating, setLocating] = useState(false);
  /** giá trị hộ chiếu mới nhất — dùng trong callback định vị (tránh closure cũ) */
  const passportRef = useRef(passport);
  useEffect(() => {
    passportRef.current = passport;
  }, [passport]);
  /** đảm bảo chỉ tự động định vị một lần khi trang vừa mở */
  const autoLocateTried = useRef(false);

  /** Hộ chiếu = "tất cả" nhưng đã chọn Nước đến → tô theo chiều ngược lại. */
  const reverseMode = !passport && !!selected;
  const destinations = useMemo(
    () => (reverseMode ? originsFor(selected) : destinationsFor(passport)),
    [passport, selected, reverseMode],
  );
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
  /** kích thước SVG lúc bắt đầu kéo — lấy 1 lần, tránh getBoundingClientRect
   * lặp lại mỗi pointermove (gây reflow, làm thao tác kéo bị giật/lag). */
  const dragRect = useRef<DOMRect | null>(null);
  /** gộp các pointermove trong cùng 1 khung hình lại, chỉ ghi viewBox 1 lần/frame */
  const dragRaf = useRef<number | null>(null);
  const pendingMove = useRef<{ x: number; y: number } | null>(null);

  const applyVB = () => {
    const v = vb.current;
    svgRef.current?.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
  };
  useEffect(applyVB, []);

  useEffect(() => {
    return () => {
      if (dragRaf.current != null) cancelAnimationFrame(dragRaf.current);
    };
  }, []);

  // Lăn chuột trên bản đồ = thu/phóng quanh vị trí con trỏ (kiểu Google Maps).
  // Phải gắn bằng addEventListener({passive:false}) — onWheel của React mặc
  // định passive nên preventDefault sẽ không chặn được cuộn trang.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 18; // đơn vị "dòng" (Firefox) → quy đổi gần đúng ra px
      else if (e.deltaMode === 2) dy *= window.innerHeight; // đơn vị "trang"
      const factor = Math.min(1.6, Math.max(0.625, Math.exp(dy * 0.0018)));
      const rect = (svg as SVGSVGElement).getBoundingClientRect();
      zoomAt(factor, e.clientX, e.clientY, rect);
    }
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  /** Thu/phóng quanh một điểm màn hình cụ thể (giữ nguyên điểm đó dưới con trỏ). */
  function zoomAt(f: number, clientX: number, clientY: number, rect: DOMRect) {
    const v = vb.current;
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;
    const px = v.x + rx * v.w;
    const py = v.y + ry * v.h;
    const w = Math.min(BASE.w, Math.max(BASE.w / 12, v.w * f));
    const h = (w * BASE.h) / BASE.w;
    vb.current = { w, h, x: px - rx * w, y: py - ry * h };
    clampVB();
    applyVB();
  }
  function resetZoom() {
    vb.current = { ...BASE };
    applyVB();
  }

  /**
   * Toạ độ GPS → mã hộ chiếu. Dùng BigDataCloud (reverse-geocode-client, miễn
   * phí, không cần API key) để đổi lat/lon sang mã nước ISO2 rồi khớp với
   * NATIONS — geo.json không có script dựng lại nên không tự tin suy ra đúng
   * phép chiếu/tỷ lệ để tự làm point-in-polygon.
   */
  async function resolvePassportFromCoords(
    lat: number,
    lon: number,
  ): Promise<string | null> {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=vi`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { countryCode?: string };
    const a2 = data.countryCode?.toLowerCase();
    if (!a2) return null;
    return NATIONS.find((n) => n.a2 === a2)?.code ?? null;
  }

  /** Bấm nút định vị: lấy GPS rồi tự chuyển ô Hộ chiếu sang nước hiện tại. */
  function locateMe() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolvePassportFromCoords(pos.coords.latitude, pos.coords.longitude)
          .then((code) => code && setPassport(code))
          .catch(() => {})
          .finally(() => setLocating(false));
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
    );
  }

  // Thử định vị một lần khi vừa mở trang, để sẵn đúng hộ chiếu cho tiện —
  // chỉ áp dụng nếu người dùng chưa tự đổi hộ chiếu trong lúc chờ kết quả.
  useEffect(() => {
    if (autoLocateTried.current) return;
    autoLocateTried.current = true;
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolvePassportFromCoords(pos.coords.latitude, pos.coords.longitude)
          .then((code) => {
            if (code && passportRef.current === DEFAULT_PASSPORT) setPassport(code);
          })
          .catch(() => {});
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (passport) {
        pickDestination(code);
      } else {
        // Chưa chọn hộ chiếu cụ thể: đổi Nước đến để bật chế độ xem ngược
        // (originsFor) trên toàn bộ bản đồ — không zoom/focus vào một nước.
        setSelected(code);
        setFocused(false);
        resetZoom();
      }
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
    dragRect.current = svgRef.current?.getBoundingClientRect() ?? null;
    moved.current = 0;
    svgRef.current?.classList.add("dragging");
    svgRef.current?.setPointerCapture(e.pointerId);
  }
  /** Ghi viewBox theo điểm chuột mới nhất — chạy tối đa 1 lần mỗi khung hình. */
  function flushDragMove() {
    dragRaf.current = null;
    const d = drag.current;
    const r = dragRect.current;
    const m = pendingMove.current;
    if (!d || !r || !m) return;
    const dx = ((m.x - d.x) * vb.current.w) / r.width;
    const dy = ((m.y - d.y) * vb.current.h) / r.height;
    vb.current.x = d.vx - dx;
    vb.current.y = d.vy - dy;
    clampVB();
    applyVB();
  }
  function onPointerMove(e: RPointerEvent<SVGSVGElement>) {
    if (!drag.current) {
      const code = codeAt(e.target);
      if (code) showTip(code, e.clientX, e.clientY);
      else hideTip();
      return;
    }
    moved.current = Math.max(
      moved.current,
      Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y),
    );
    pendingMove.current = { x: e.clientX, y: e.clientY };
    if (dragRaf.current == null) {
      dragRaf.current = requestAnimationFrame(flushDragMove);
    }
  }
  const endDrag = () => {
    drag.current = null;
    dragRect.current = null;
    pendingMove.current = null;
    if (dragRaf.current != null) {
      cancelAnimationFrame(dragRaf.current);
      dragRaf.current = null;
    }
    svgRef.current?.classList.remove("dragging");
  };
  /** Chọn một nước làm hộ chiếu đang xem — dùng ở chế độ xem ngược. */
  function pickOrigin(code: string) {
    if (code !== selected) setPassport(code);
  }

  function onClick(e: RMouseEvent<SVGSVGElement>) {
    if (moved.current > 5) return;
    // setPointerCapture (cho kéo-thả) khiến e.target luôn là <svg> gốc ở đây,
    // nên phải dò lại phần tử thật dưới con trỏ bằng toạ độ.
    const real = document.elementFromPoint(e.clientX, e.clientY);
    const code = real && codeAt(real);
    if (!code || tierOf(code) === "nodata") return;
    if (reverseMode) {
      pickOrigin(code);
      return;
    }
    setSelected(code);
    setFocused(false);
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
    if (!reverseMode && selected && d.code !== selected) return false;
    if (tierFilter && d.tier !== tierFilter) return false;
    return true;
  });

  const nationOptions: ComboOption[] = NATIONS.map((n) => ({
    value: n.code,
    label: n.name,
    flag: flagSrc(n.a2),
  }));
  const passportOptions: ComboOption[] = [
    { value: "", label: "Tất cả các hộ chiếu" },
    ...nationOptions,
  ];
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
    <div className="mapapp">
      <div className="mapapp-view">
        <div className="mapapp-stage" ref={stageRef} hidden={view !== "map"}>
          <svg
            ref={svgRef}
            className="map"
            viewBox="0 0 1000 480"
            role="img"
            aria-label={
              reverseMode
                ? `Bản đồ thế giới tô màu theo mức thủ tục mà hộ chiếu từng nước cần để vào ${passportName(
                    selected,
                  )}. Bảng dữ liệu tương đương có ở chế độ xem Bảng.`
                : `Bản đồ thế giới tô màu theo mức thủ tục nhập cảnh đối với hộ chiếu ${passportName(
                    passport,
                  )}. Bảng dữ liệu tương đương có ở chế độ xem Bảng.`
            }
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
        </div>

        <div className="mapapp-table" hidden={view !== "table"}>
          <div className="table-bar">
            <span>
              {tableRows.length} {reverseMode ? "hộ chiếu" : "nước"}
              {tierFilter && ` · ${metaOf(tierFilter).label}`}
            </span>
            {(selected || tierFilter) && (
              <button
                className="table-clear"
                onClick={() => {
                  setSelected("");
                  setTierFilter("");
                  setFocused(false);
                }}
              >
                Xoá lọc
              </button>
            )}
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{reverseMode ? "Hộ chiếu" : "Nước đến"}</th>
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
                        onClick={() =>
                          reverseMode ? pickOrigin(d.code) : pickDestination(d.code)
                        }
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

        {view === "map" && (
          <div className="locate mapapp-locate">
            <button
              title="Dùng vị trí của bạn để chọn hộ chiếu"
              aria-label="Dùng vị trí của bạn để chọn hộ chiếu"
              className={locating ? "spin" : undefined}
              disabled={locating}
              onClick={locateMe}
            >
              ⌖
            </button>
          </div>
        )}

        {view === "map" && (
          <div className="zoom mapapp-zoom">
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
        )}
      </div>

      <div className="mapapp-toolbar">
        <Combobox
          label="Hộ chiếu"
          value={passport}
          options={passportOptions}
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

        {focused && (
          <button className="focus-clear" onClick={clearFocus}>
            ← Hiện tất cả các nước
          </button>
        )}
      </div>

      {view === "map" && (
        <div className={`mapapp-legend${legendOpen ? "" : " collapsed"}`}>
          <div className="legend-scale">
            <span className="eyebrow">Thang thứ bậc · bấm để lọc</span>
            <button
              type="button"
              className="legend-toggle"
              aria-expanded={legendOpen}
              onClick={() => setLegendOpen((v) => !v)}
            >
              {legendOpen ? "Thu gọn" : "Mở rộng"}
              <span className="legend-toggle-caret" aria-hidden="true">
                {legendOpen ? "▾" : "▸"}
              </span>
            </button>
          </div>
          {legendOpen && (
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
          )}
        </div>
      )}

      <div className="mapapp-panel">
        <div className="panel-head">
          <div className="eyebrow">
            Bản đồ chính sách nhập cảnh · {NATIONS.length} hộ chiếu ×{" "}
            {NATIONS.length} điểm đến
          </div>
          <h1 className="panel-title">
            {passport
              ? `Hộ chiếu ${passportName(passport)} đi đâu?`
              : selected
                ? `Vào ${passportName(selected)} cần visa gì?`
                : "Tất cả hộ chiếu đi đâu?"}
          </h1>
        </div>

        {!passport && !selected ? (
          <>
            <div className="verdict-head">
              <div>
                <h2 className="verdict-name">Chưa chọn hộ chiếu</h2>
                <div className="iso">HỘ CHIẾU TẤT CẢ → TỔNG QUAN</div>
              </div>
            </div>
            <p className="verdict-note">
              Mỗi hộ chiếu có mức thủ tục khác nhau ở từng nước, nên khi để{" "}
              <strong>Hộ chiếu</strong> là &quot;tất cả&quot; thì bản đồ chưa
              có gì để tô màu. Chọn một hộ chiếu cụ thể để xem hộ chiếu đó đi
              đâu được, hoặc chọn một <strong>Nước đến</strong> để xem nước đó
              cần visa gì từ mọi hộ chiếu.
            </p>
          </>
        ) : reverseMode ? (
          <>
            <div className="verdict-head">
              <div>
                <h2 className="verdict-name">
                  {passportFlag(selected) && (
                    <img
                      className="flag-img flag-lg"
                      src={passportFlag(selected) as string}
                      alt=""
                      width={28}
                      height={21}
                    />
                  )}
                  {passportName(selected)}
                </h2>
                <div className="iso">TẤT CẢ HỘ CHIẾU → {selected}</div>
              </div>
            </div>
            <p className="verdict-note">
              Bản đồ đang tô theo mức thủ tục mà hộ chiếu <strong>từng
              nước</strong> cần để vào {passportName(selected)}. Bấm vào một
              nước trên bản đồ (hoặc một dòng trong bảng) để xem chi tiết hộ
              chiếu đó đi đâu được.
            </p>
            <dl className="facts">
              <div className="fact">
                <dt>Miễn thị thực</dt>
                <dd>
                  {counts.free ?? 0}
                  <small>hộ chiếu</small>
                </dd>
              </div>
              <div className="fact">
                <dt>Làm online</dt>
                <dd>
                  {(counts.eta ?? 0) + (counts.evisa ?? 0)}
                  <small>hộ chiếu</small>
                </dd>
              </div>
              <div className="fact">
                <dt>Visa tại ĐSQ</dt>
                <dd>
                  {counts.visa ?? 0}
                  <small>hộ chiếu</small>
                </dd>
              </div>
            </dl>
          </>
        ) : sel ? (
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
            {selMeta.steps && selMeta.steps.length > 0 && (
              <div className="steps">
                <h3>Cần chuẩn bị gì</h3>
                <ol>
                  {selMeta.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
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

        <div className="panel-insights">
          <h3>Bản đồ này nói lên điều gì</h3>
          <ul className="ins">
            <li>
              <span className="num">{counts.free ?? 0}</span>
              <p>
                <b>{reverseMode ? "Hộ chiếu miễn thị thực" : "Nước miễn thị thực"}</b>{" "}
                {reverseMode ? (
                  <>khi vào {passportName(selected)}</>
                ) : (
                  <>cho hộ chiếu {passportName(passport)}</>
                )}{" "}
                — vào thẳng, không giấy tờ xin trước.
              </p>
            </li>
            <li>
              <span className="num">{counts.evisa ?? 0}</span>
              <p>
                <b>{reverseMode ? "Hộ chiếu" : "Nước"} cấp eVisa online.</b> Nộp
                hồ sơ qua web, nhận file PDF, không cần đến đại sứ quán.
              </p>
            </li>
            <li>
              <span className="num">{counts.visa ?? 0}</span>
              <p>
                <b>{reverseMode ? "Hộ chiếu" : "Nước"} phải xin visa tại đại sứ
                quán</b> — nộp hồ sơ giấy trực tiếp, chờ 1–4 tuần rồi mới bay
                được.
              </p>
            </li>
            <li>
              <span className="num">{pct}%</span>
              <p>
                <b>
                  {reverseMode ? "Hộ chiếu" : "Điểm đến"} làm được thủ tục
                  không cần đến đại sứ quán
                </b>{" "}
                — tính cả miễn thị thực, eTA, eVisa và cấp tại cửa khẩu.
              </p>
            </li>
          </ul>
        </div>

        <div className="mrz" suppressHydrationWarning>
          {mrz}
        </div>
      </div>
    </div>
  );
}
