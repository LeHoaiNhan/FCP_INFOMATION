import geoRaw from "@/data/geo.json";
import policyRaw from "@/data/policy.json";
import type { AnyTier } from "./tiers";

/** Một quốc gia / vùng lãnh thổ trên bản đồ, đã gộp hình học + chính sách. */
export interface Country {
  /** mã ISO-3166 numeric (khớp Natural Earth) */
  id: string;
  name: string;
  /** path SVG (phép chiếu Equal Earth, viewBox 1000×480) */
  d: string;
  tier: AnyTier;
  /** số ngày lưu trú tối đa */
  stay: number | null;
  /** lệ phí nhà nước, USD (0 = miễn phí) */
  fee: number | null;
  /** thời gian xử lý, ngày làm việc */
  processing: number | null;
  /** link cổng chính thức của cơ quan cấp — cần cho bản chạy thật */
  officialUrl: string | null;
  /** ngày kiểm chứng gần nhất, ISO (YYYY-MM-DD) */
  lastVerified: string | null;
}

type GeoRow = { id: string; name: string; d: string };
type PolicyTuple = [AnyTier, number?, number?, number?];

const GEO = geoRaw as GeoRow[];
const POLICY = policyRaw as unknown as Record<string, PolicyTuple>;

/**
 * Nguồn dữ liệu duy nhất của app.
 *
 * Hiện đọc từ file tĩnh trong /data (hình học Natural Earth 110m + chính sách mẫu).
 * Khi chuyển sang Supabase: thay thân hàm bằng
 *
 *   const { data } = await supabase.from("countries").select("*");
 *
 * rồi map sang cùng kiểu `Country`. Toàn bộ UI không cần đổi.
 */
export async function getCountries(): Promise<Country[]> {
  return GEO.map((g) => {
    const p = POLICY[g.name] ?? (["nodata"] as PolicyTuple);
    return {
      id: g.id,
      name: g.name,
      d: g.d,
      tier: p[0],
      stay: p[1] ?? null,
      fee: p[2] ?? null,
      processing: p[3] ?? null,
      officialUrl: null,
      lastVerified: null,
    };
  });
}

/** true nếu dữ liệu phí/lưu trú vẫn là số mẫu, chưa đối chiếu nguồn chính thức. */
export const DATA_IS_SAMPLE = true;
