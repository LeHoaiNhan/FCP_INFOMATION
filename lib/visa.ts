import geoRaw from "@/data/geo.json";
import nationsRaw from "@/data/nations.json";
import matrixRaw from "@/data/requirements.json";
import { decodeRequirement, ORDER, type AnyTier } from "./tiers";

/** Một nước / vùng lãnh thổ — dùng cho cả dropdown hộ chiếu và điểm đến. */
export interface Nation {
  /** ISO-3166 alpha-3 */
  code: string;
  name: string;
}

/** Hình đa giác một nước trên bản đồ (Equal Earth, viewBox 1000×480). */
export interface GeoShape {
  id: string;
  name: string;
  d: string;
  iso3: string;
}

/** Một điểm đến, đã gộp yêu cầu visa (theo hộ chiếu đang chọn) + hình học. */
export interface Destination {
  code: string;
  name: string;
  /** path SVG — null nếu nước quá nhỏ, không có đa giác ở độ phân giải 110m */
  d: string | null;
  tier: AnyTier;
  /** số ngày lưu trú tối đa khi miễn thị thực */
  stay: number | null;
  /** lệ phí nhà nước, USD — dataset không có, cần nguồn khác / nhập tay */
  fee: number | null;
  /** thời gian xử lý, ngày làm việc — dataset không có */
  processing: number | null;
  /** link cổng chính thức của cơ quan cấp */
  officialUrl: string | null;
  /** ngày kiểm chứng gần nhất, ISO */
  lastVerified: string | null;
}

export const NATIONS = nationsRaw as Nation[];
export const GEO = geoRaw as GeoShape[];

const MATRIX = matrixRaw as Record<string, Record<string, string>>;
const GEO_BY_ISO3: Record<string, GeoShape> = Object.fromEntries(
  GEO.map((g) => [g.iso3, g]),
);
const NAME_BY_CODE: Record<string, string> = Object.fromEntries(
  NATIONS.map((n) => [n.code, n.name]),
);

export const DEFAULT_PASSPORT = "VNM";

export function isKnownPassport(code: string | null | undefined): boolean {
  return !!code && code in MATRIX;
}

/**
 * Toàn bộ 199 điểm đến cho một hộ chiếu, đã sắp theo mức thủ tục rồi theo tên.
 *
 * Hiện đọc từ ma trận tĩnh (passport-index-dataset). Khi chuyển sang Supabase,
 * thay bằng:  supabase.from("requirements").select().eq("passport", passport)
 * rồi map sang cùng kiểu `Destination` — UI không đổi.
 */
export function destinationsFor(passport: string): Destination[] {
  const row = MATRIX[passport] ?? MATRIX[DEFAULT_PASSPORT];
  return NATIONS.map((n) => {
    const raw = row[n.code] ?? "";
    const { tier, stay } = decodeRequirement(raw);
    const shape = GEO_BY_ISO3[n.code];
    return {
      code: n.code,
      name: n.name,
      d: shape?.d ?? null,
      tier: n.code === passport ? "home" : tier,
      stay,
      fee: null,
      processing: null,
      officialUrl: null,
      lastVerified: null,
    };
  }).sort(
    (a, b) =>
      (ORDER[a.tier] ?? 9) - (ORDER[b.tier] ?? 9) ||
      a.name.localeCompare(b.name),
  );
}

export function passportName(code: string): string {
  return NAME_BY_CODE[code] ?? code;
}
