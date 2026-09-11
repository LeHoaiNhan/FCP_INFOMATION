import type { Metadata } from "next";
import PassportGallery from "@/components/passport-gallery";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Bộ sưu tập hộ chiếu — chọn hộ chiếu của bạn",
  description:
    "Xem ảnh bìa hộ chiếu 99 nước, chọn hộ chiếu của bạn để xem bản đồ chính sách nhập cảnh chi tiết.",
};

export default function Page() {
  return <PassportGallery />;
}
