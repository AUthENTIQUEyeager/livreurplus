"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LIENS = [
  { href: "/commercant/dashboard", label: "Tableau de bord" },
  { href: "/commercant/catalogue", label: "Catalogue" },
  { href: "/commercant/commandes", label: "Commandes" },
  { href: "/commercant/personnalisation", label: "Personnaliser" },
];

export default function NavCommercant({ nom }: { nom: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function deconnexion() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/commercant/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-route">
              <span className="font-display text-xs font-bold text-white">L+</span>
            </div>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {LIENS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === l.href
                    ? "bg-route-tint text-route-dark"
                    : "text-ink/60 hover:bg-mist"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-ink/60 sm:inline">{nom}</span>
          <button onClick={deconnexion} className="btn-secondary !py-2 !px-3 text-xs">
            Déconnexion
          </button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 md:hidden">
        {LIENS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
              pathname === l.href ? "bg-route-tint text-route-dark" : "text-ink/60"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
