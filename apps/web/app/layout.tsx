import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SPulso",
  description: "Gestion humana en tiempo real para empresas escalables.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                try {
                  const theme = localStorage.getItem("spulso_theme_v3") || "light";
                  const allowed = ["light", "dark", "star"];
                  const nextTheme = allowed.includes(theme) ? theme : "light";
                  document.documentElement.dataset.theme = nextTheme;
                  document.documentElement.classList.toggle("dark", nextTheme === "dark");
                } catch {}
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
