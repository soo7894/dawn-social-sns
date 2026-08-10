import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "dawn. | 순간을 나누는 공간",
  description: "사진과 일상의 영감을 나누는 소셜 플랫폼 dawn.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
