import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { BRAND_ICON_URL } from "@/lib/brand";
import { UserRoleProvider } from "@/components/auth/user-role-provider";
import { USER_ROLE_COOKIE_NAME, type UserRole } from "@/components/auth/constants";
import { EnvironmentBanner } from "@/components/layout/environment-banner";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { ThemeBootstrap } from "@/components/theme/theme-bootstrap";
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
  title: "RaroNexus",
  description: "Identity Provider corporativo para multiplos sistemas.",
  icons: {
    icon: BRAND_ICON_URL,
    shortcut: BRAND_ICON_URL,
    apple: BRAND_ICON_URL,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const rawRole = cookieStore.get(USER_ROLE_COOKIE_NAME)?.value;
  const initialRole: UserRole = rawRole === "admin" || rawRole === "user" ? rawRole : null;

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-950 text-slate-100 flex flex-col">
        <ThemeBootstrap />
        <ServiceWorkerRegister />
        <EnvironmentBanner />
        <UserRoleProvider initialRole={initialRole}>
          {children}
        </UserRoleProvider>
      </body>
    </html>
  );
}
