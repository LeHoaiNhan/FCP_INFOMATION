/**
 * Thang thứ bậc "mức thủ tục" một hộ chiếu phải làm trước chuyến đi.
 * Thứ tự = độ nặng thủ tục, cũng là thứ tự đậm dần của thang màu xanh.
 */

export type TierKey = "free" | "eta" | "evisa" | "voa" | "visa";
export type SpecialKey = "home" | "nodata";
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

export const EXTRA: Record<SpecialKey, { label: string; cls: string; v: string }> = {
  home: { label: "Việt Nam", cls: "t-home", v: "--home-fill" },
  nodata: { label: "Chưa có dữ liệu", cls: "t-nodata", v: "--nodata" },
};

/** thứ hạng để sắp bảng: free=0 … visa=4 */
export const ORDER: Record<string, number> = Object.fromEntries(
  TIERS.map((t, i) => [t.k, i]),
);

export function metaOf(tier: AnyTier): { label: string; cls: string; v: string; short?: string } {
  if (tier in TMAP) return TMAP[tier as TierKey];
  return EXTRA[tier as SpecialKey];
}
