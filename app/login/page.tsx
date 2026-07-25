"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [role, setRole] = useState<Role>("commercant");
  const [mode, setMode] = useState<"connexion" | "inscription">("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [nom, setNom] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [messageInfo, setMessageInfo] = useState<string | null>(null);

  const supabase = createClient();

  async function connexionGoogle() {
    setErreur(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      next
    )}&role=${role}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) setErreur(error.message);
  }

  async function soumettreEmail(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setMessageInfo(null);
    setChargement(true);

    if (mode === "inscription") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: motDePasse,
        options: { data: { role, nom } },
      });
      setChargement(false);
      if (error) return setErreur(error.message);
      if (!data.session) {
        setMessageInfo("Compte créé. Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.");
        return;
      }
      router.push(next);
      router.refresh();
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: motDePasse,
      });
      setChargement(false);
      if (error) return setErreur("Email ou mot de passe incorrect.");
      router.push(next);
      router.refresh();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-mist px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-route">
            <span className="font-display text-lg font-bold text-white">L+</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">LivreurPlus</h1>
          <p className="mt-1 text-sm text-ink/60">Livraison locale, suivie en direct.</p>
        </div>

        <div className="card p-6">
          {/* Sélecteur de rôle */}
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-mist p-1">
            <button
              type="button"
              onClick={() => setRole("commercant")}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                role === "commercant" ? "bg-white text-ink shadow-card" : "text-ink/50"
              }`}
            >
              Commerçant
            </button>
            <button
              type="button"
              onClick={() => setRole("livreur")}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                role === "livreur" ? "bg-white text-ink shadow-card" : "text-ink/50"
              }`}
            >
              Livreur
            </button>
          </div>

          <button
            type="button"
            onClick={connexionGoogle}
            className="btn-secondary w-full"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>
            </svg>
            Continuer avec Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs text-ink/40">ou avec un email</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={soumettreEmail} className="space-y-4">
            {mode === "inscription" && (
              <div>
                <label className="label">Nom complet</label>
                <input
                  className="input"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                  placeholder="Ex. Emmanuel Ouédraogo"
                />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="toi@exemple.com"
              />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input
                type="password"
                className="input"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
              />
            </div>

            {erreur && (
              <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{erreur}</p>
            )}
            {messageInfo && (
              <p className="rounded-lg bg-route-tint px-3 py-2 text-sm text-route-dark">{messageInfo}</p>
            )}

            <button type="submit" disabled={chargement} className="btn-primary w-full">
              {chargement ? "Un instant…" : mode === "connexion" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-ink/60">
            {mode === "connexion" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <button
              type="button"
              className="font-semibold text-route hover:underline"
              onClick={() => setMode(mode === "connexion" ? "inscription" : "connexion")}
            >
              {mode === "connexion" ? "Inscris-toi" : "Connecte-toi"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
