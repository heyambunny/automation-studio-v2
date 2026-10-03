import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeContextProvider } from "@/lib/theme-context";
import { ToastProvider } from "@/components/ui/toast";
import { GoogleAnalytics } from "@/components/google-analytics";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Automation Studio",
  description: "Smart reporting, automated emails, AI-powered insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const dark = localStorage.getItem("dark_mode");
                if (dark === "true" || (!dark && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
                  document.documentElement.classList.add("dark");
                }
              } catch (e) {}
              try {
                // One-time cleanup: auth used to live in localStorage (persisted
                // indefinitely); it now lives in sessionStorage (cleared when the
                // browser closes). Purge any leftover localStorage copy so an old
                // token can never be read from anywhere again.
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                localStorage.removeItem("user");
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <TooltipProvider>
          <ThemeContextProvider>
            <ThemeProvider>
              <ToastProvider>{children}</ToastProvider>
            </ThemeProvider>
          </ThemeContextProvider>
        </TooltipProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
