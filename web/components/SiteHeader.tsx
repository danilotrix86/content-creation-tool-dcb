"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Generate" },
  { href: "/articles", label: "Past articles" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="mb-12 text-center">
      <div className="mb-4 flex justify-center">
        <Link
          href="/"
          className="flex h-14 w-14 items-center justify-center rounded-xl bg-teal-500 shadow-lg shadow-teal-500/25 transition-transform hover:scale-105"
          aria-label="Content Creator home"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="white"
            className="h-7 w-7"
          >
            <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
          </svg>
        </Link>
      </div>
      <Link href="/">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl md:text-5xl">
          Content Creator
        </h1>
      </Link>
      <p className="mt-3 text-base text-gray-600 sm:text-lg">
        AI-powered article generation with competitor research, SEO optimization,
        and visual assets
      </p>
      <nav
        className="mt-6 flex justify-center gap-2"
        aria-label="Main navigation"
      >
        {navItems.map(({ href, label }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-teal-500 text-white shadow-md shadow-teal-500/25"
                  : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
