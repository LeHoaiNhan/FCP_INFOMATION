import { getCountries } from "@/lib/countries";
import PassportMap from "@/components/passport-map";

// Data đọc lúc build từ /data. Khi nối Supabase, đổi sang `force-dynamic`
// hoặc thêm `revalidate` tuỳ nhịp cập nhật.
export const dynamic = "force-static";

export default async function Page() {
  const countries = await getCountries();
  return <PassportMap countries={countries} />;
}
