import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zestawienia materiałów",
  description: "System zestawień materiałów dla wykonawców",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
