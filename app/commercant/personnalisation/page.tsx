"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Commerce } from "@/lib/types";
import { THEME_PRESETS } from "@/lib/theme-presets";

export default function PersonnalisationPage() {
  const supabase = createClient();
  const [chargement, setChargement] = useState(true);
  const [commerce, setCommerce] = useState<Commerce | null>(null);

  const [banniereUrl, setBanniereUrl] = useState("");
  const [bio, setBio] = useState("");
  const [theme, setTheme] = useState("route");

  const [enregistrement, setEnregistrement] = useState(false);
  const [confirme, setConfirme] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: com } = await supabase
        .from("commerces")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (com) {
        setCommerce(com);
        setBanniereUrl(com.banniere_url ?? "");
        setBio(com.bio ?? "");
        setTheme(com.theme ?? "route");
      }
      setChargement(false);
    })();
  }, []);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!commerce) return;
    setEnregistrement(true);
    setErreur(null);
    setConfirme(false);

    const { data, error } = await supabase
      .from("commerces")
      .update({
        banniere_url: banniereUrl.trim() || null,
        bio: bio.trim() || null,
        theme,
      })
      .eq("id", commerce.id)
      .select()
      .single();

    setEnregistrement(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    setCommerce(data);
    setConfirme(true);
  }

  if (chargement) {
    return <p className="text-sm text-ink/50">Chargement…</p>;
  }

  if (!commerce) {
    return (
      <p className="text-sm text-ink/60">
        Crée d&apos;abord ta boutique depuis le{" "}
        <Link href="/commercant/dashboard" className="font-medium text-route hover:underline">
          tableau de bord
        </Link>
        .
      </p>
    );
  }

  const presetActuel = THEME_PRESETS.find((t) => t.id === theme) ?? THEME_PRESETS[0];

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-2xl font-bold text-ink">Personnaliser ma boutique</h1>
      <p className="mt-1 text-sm text-ink/60">
        Ces réglages s&apos;appliquent à ta page publique{" "}
        <Link href={`/boutique/${commerce.slug}`} className="font-medium text-route hover:underline">
          /boutique/{commerce.slug}
        </Link>
        .
      </p>

      <form onSubmit={enregistrer} className="card mt-6 space-y-5 p-6">
        <div>
          <label className="label">Couleur du thème</label>
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  theme === t.id ? "border-ink" : "border-line hover:bg-mist"
                }`}
              >
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: t.accent }}
                />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Bannière (URL image)</label>
          <input
            className="input"
            value={banniereUrl}
            onChange={(e) => setBanniereUrl(e.target.value)}
            placeholder="https://…"
          />
          <p className="mt-1 text-xs text-ink/40">
            Format large recommandé (ex. 1200×400). Laisse vide pour ne pas afficher de bannière.
          </p>
        </div>

        <div>
          <label className="label">Bio / présentation</label>
          <textarea
            className="input"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Présente ta boutique, ton histoire, tes engagements…"
          />
        </div>

        {/* Aperçu rapide */}
        <div>
          <label className="label">Aperçu</label>
          <div className="overflow-hidden rounded-xl border border-line">
            {banniereUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={banniereUrl} alt="" className="h-24 w-full object-cover" />
            )}
            <div className="p-4 text-center">
              <div
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: presetActuel.accentTint }}
              >
                <span className="font-display text-xs font-bold" style={{ color: presetActuel.accentDark }}>
                  {commerce.nom_boutique.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <p className="mt-2 font-display text-sm font-bold text-ink">{commerce.nom_boutique}</p>
              {bio && <p className="mt-1 line-clamp-2 text-xs text-ink/60">{bio}</p>}
            </div>
          </div>
        </div>

        {erreur && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{erreur}</p>}
        {confirme && (
          <p className="rounded-lg bg-route-tint px-3 py-2 text-sm text-route-dark">
            Enregistré ✓
          </p>
        )}

        <button type="submit" disabled={enregistrement} className="btn-primary w-full">
          {enregistrement ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
