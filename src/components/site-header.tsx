"use client";

import Image from "next/image";
import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

const links = [
  { id: "inicio", label: "Inicio", href: "/" },
  { id: "it", label: "IT", href: "/it" },
  { id: "wms", label: "WMS", href: "/areas/wms" },
  { id: "auditoria", label: "Auditoría", href: "/areas/auditoria" },
  { id: "ventas", label: "Ventas", href: "/areas/ventas" },
  { id: "compras", label: "Compras", href: "/areas/compras" },
  { id: "comex", label: "COMEX", href: "/areas/comex" },
  { id: "capital-humano", label: "Capital Humano", href: "/areas/capital-humano" },
] as const;

function getActiveIndex(pathname: string) {
  if (pathname === "/") return 0;
  const index = links.findIndex((link) => pathname === link.href || pathname.startsWith(`${link.href}/`));
  return index >= 0 ? index : 0;
}

type SiteHeaderProps = {
  user?: {
    name?: string;
    email?: string;
  };
};

function getInitials(name?: string, email?: string) {
  const source = name?.trim() || email?.split("@")[0] || "GA";
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function SiteHeader({ user }: SiteHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const initialIndex = getActiveIndex(pathname);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [indicatorReady, setIndicatorReady] = useState(false);

  useEffect(() => {
    setActiveIndex(getActiveIndex(pathname));
  }, [pathname]);

  useLayoutEffect(() => {
    const element = linkRefs.current[activeIndex];
    if (element) {
      setIndicatorStyle({ left: element.offsetLeft, width: element.offsetWidth });
    }
    const frame = window.requestAnimationFrame(() => setIndicatorReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex]);

  useEffect(() => {
    const updateIndicator = () => {
      const element = linkRefs.current[activeIndex];
      if (element) setIndicatorStyle({ left: element.offsetLeft, width: element.offsetWidth });
    };
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeIndex]);

  function selectTab(event: MouseEvent<HTMLAnchorElement>, index: number, href: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();

    const target = event.currentTarget;
    setIndicatorStyle({ left: target.offsetLeft, width: target.offsetWidth });
    setActiveIndex(index);
    router.push(href);
  }

  return (
    <header className="border-b border-[var(--line)] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-20 max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-10">
        <Link href="/" className="flex items-center" aria-label="Grupo Aftermarket - Inicio">
          <span className="relative block h-11 w-[175px] overflow-hidden sm:h-12 sm:w-[190px]">
            <Image
              src="/grupo-aftermarket.svg"
              alt="Grupo Aftermarket"
              width={1280}
              height={720}
              priority
              className="h-auto w-full"
            />
          </span>
        </Link>

        <nav className="relative order-3 flex w-full items-center gap-1 overflow-x-auto rounded-full border border-[var(--line)] bg-[var(--soft)] p-1 xl:order-none xl:w-auto" aria-label="Navegación principal">
          <span
            aria-hidden="true"
            className="absolute inset-y-1 rounded-full bg-white shadow-sm"
            style={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
              transition: indicatorReady
                ? "left .4s cubic-bezier(.65,0,.35,1), width .4s cubic-bezier(.65,0,.35,1)"
                : "none",
            }}
          />
          {links.map((link, index) => (
            <Link
              key={link.id}
              href={link.href}
              ref={(element) => {
                linkRefs.current[index] = element;
              }}
              onClick={(event) => selectTab(event, index, link.href)}
              aria-current={activeIndex === index ? "page" : undefined}
              className={`relative z-10 shrink-0 rounded-full px-3 py-2 text-center text-xs transition-colors duration-[400ms] ease-[cubic-bezier(.65,0,.35,1)] 2xl:px-4 2xl:text-sm ${
                activeIndex === index
                  ? "font-semibold text-[var(--ink)]"
                  : "font-medium text-[var(--muted)] hover:text-[var(--navy)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {user?.email ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-40 truncate text-sm font-semibold">{user.name || user.email.split("@")[0]}</p>
              <p className="text-xs text-[var(--muted)]">Grupo Aftermarket</p>
            </div>
            <div className="grid size-10 place-items-center rounded-full bg-[var(--navy)] text-sm font-bold text-white ring-4 ring-[var(--navy-soft)]">
              {getInitials(user.name, user.email)}
            </div>
            <button
              type="button"
              onClick={() => signOut({ redirectTo: "/" })}
              className="grid size-9 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--navy)]"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut aria-hidden="true" className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => signIn("google", { redirectTo: pathname })}
            className="flex items-center gap-2 rounded-full bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173d60]"
          >
            <LogIn aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Ingresar</span>
          </button>
        )}
      </div>
    </header>
  );
}
