import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// docs/06 section 7: Inter covers Vietnamese.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

// Product name only; it is the same in every language.
export const metadata: Metadata = {
  title: "TaskFlow",
};

// `lang` is the default locale here: the user's locale is only known at request time,
// so localized content sets its own `lang` inside <Suspense> (ADR-12, src/i18n/request.ts).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
