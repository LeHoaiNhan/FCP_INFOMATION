import PassportMap from "@/components/passport-map";

// Data đọc từ /data lúc build. Khi nối Supabase, chuyển sang đọc theo hộ chiếu
// qua route handler / server action rồi bỏ import tĩnh trong lib/visa.ts.
export const dynamic = "force-static";

export default function Page() {
  return <PassportMap />;
}
