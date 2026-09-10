/**
 * Thang thứ bậc "mức thủ tục" một hộ chiếu phải làm trước chuyến đi.
 * Thứ tự = độ nặng thủ tục, cũng là thứ tự đậm dần của thang màu xanh.
 */

export type TierKey = "free" | "eta" | "evisa" | "voa" | "visa";
export type SpecialKey = "home" | "nodata" | "noadmission";
export type AnyTier = TierKey | SpecialKey;

export interface Tier {
  k: TierKey;
  /** hạng 1..5 */
  n: number;
  label: string;
  short: string;
  /** class tô màu path trên SVG */
  cls: string;
  /** class thanh màu ở chú giải */
  bar: string;
  /** biến CSS dùng cho ô màu nhỏ (swatch) */
  v: string;
}

export const TIERS: Tier[] = [
  { k: "free", n: 1, label: "Miễn thị thực", short: "Miễn thị thực", cls: "t-free", bar: "tier-b1", v: "--t1" },
  { k: "eta", n: 2, label: "eTA — cấp phép điện tử", short: "eTA", cls: "t-eta", bar: "tier-b2", v: "--t2" },
  { k: "evisa", n: 3, label: "eVisa — thị thực điện tử", short: "eVisa", cls: "t-evisa", bar: "tier-b3", v: "--t3" },
  { k: "voa", n: 4, label: "Cấp tại cửa khẩu", short: "Tại cửa khẩu", cls: "t-voa", bar: "tier-b4", v: "--t4" },
  { k: "visa", n: 5, label: "Phải xin trước", short: "Xin visa trước", cls: "t-visa", bar: "tier-b5", v: "--t5" },
];

export const TMAP: Record<TierKey, Tier> = Object.fromEntries(
  TIERS.map((t) => [t.k, t]),
) as Record<TierKey, Tier>;

export const EXTRA: Record<SpecialKey, { label: string; cls: string; v: string; short: string }> = {
  home: { label: "Nước cấp hộ chiếu", short: "Nước nhà", cls: "t-home", v: "--home-fill" },
  nodata: { label: "Chưa có dữ liệu", short: "—", cls: "t-nodata", v: "--nodata" },
  noadmission: { label: "Không được nhập cảnh", short: "Cấm nhập cảnh", cls: "t-noadmission", v: "--noadmission" },
};

/** thứ hạng để sắp bảng: free=0 … visa=4, các mức đặc biệt xuống cuối */
export const ORDER: Record<string, number> = {
  ...Object.fromEntries(TIERS.map((t, i) => [t.k, i])),
  noadmission: 5,
  home: 6,
  nodata: 7,
};

export function metaOf(
  tier: AnyTier,
): { label: string; cls: string; v: string; short: string } {
  if (tier in TMAP) return TMAP[tier as TierKey];
  return EXTRA[tier as SpecialKey];
}

/**
 * Giải mã một ô trong ma trận passport-index sang { tier, stay }.
 *
 * Giá trị nguồn (đã nén 1 ký tự khi build):
 *   "R" visa required · "O" visa on arrival · "E" e-visa · "T" eTA
 *   "F" visa free (không rõ số ngày) · "N" no admission · "H" chính nước đó
 *   "<số>" miễn thị thực, lưu trú tối đa <số> ngày
 */
export function decodeRequirement(code: string): { tier: AnyTier; stay: number | null } {
  if (/^\d+$/.test(code)) return { tier: "free", stay: parseInt(code, 10) };
  switch (code) {
    case "F": return { tier: "free", stay: null };
    case "T": return { tier: "eta", stay: null };
    case "E": return { tier: "evisa", stay: null };
    case "O": return { tier: "voa", stay: null };
    case "R": return { tier: "visa", stay: null };
    case "N": return { tier: "noadmission", stay: null };
    case "H": return { tier: "home", stay: null };
    default: return { tier: "nodata", stay: null };
  }
}
