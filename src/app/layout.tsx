import type { Metadata } from "next";
import { auth } from "@/auth";
import { AccessGate } from "@/components/access-gate";
import { CurrentUserProvider } from "@/components/current-user-provider";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal interno | Grupo Aftermarket",
  description: "Accesos y recursos internos de Grupo Aftermarket.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();

  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {session?.user ? (
          <CurrentUserProvider
            user={{ name: session.user.name ?? undefined, email: session.user.email ?? undefined }}
          >
            <SiteHeader user={{ name: session.user.name ?? undefined, email: session.user.email ?? undefined }} />
            {children}
          </CurrentUserProvider>
        ) : (
          <AccessGate />
        )}
      </body>
    </html>
  );
}
