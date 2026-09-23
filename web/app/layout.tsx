import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { auth } from "@/auth";
import { logout } from "./actions";
import { homeFor } from "@/lib/session";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Media Analysis",
  description: "Recover, analyze and clip archive documentaries",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const user = session?.user;
  const roles = user?.roles ?? [];

  const links: { href: string; label: string }[] = [];
  if (roles.includes("admin")) {
    links.push({ href: "/admin", label: "Dashboard" });
    links.push({ href: "/admin/videos", label: "Videos" });
    links.push({ href: "/admin/users", label: "Users" });
  }
  if (roles.includes("analyst")) links.push({ href: "/analyst", label: "My Assignments" });
  if (roles.includes("editor")) links.push({ href: "/editor", label: "Editing" });

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-100`}>
        {user ? (
          <header className="border-b border-slate-800 bg-slate-900/60">
            <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
              <Link href={homeFor(roles)} className="font-semibold text-emerald-400">
                Media Analysis
              </Link>
              <nav className="flex flex-1 gap-3 text-sm">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} className="text-slate-300 hover:text-white">
                    {l.label}
                  </Link>
                ))}
              </nav>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-slate-400">
                  {user.name} <span className="text-slate-600">({roles.join(", ")})</span>
                </span>
                <form action={logout}>
                  <button className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </header>
        ) : null}
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}