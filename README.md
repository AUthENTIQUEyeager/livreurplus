# LivreurPlus V2

Marketplace de livraison locale : un commerçant publie son catalogue, un client
commande et partage sa position, le commerçant assigne un livreur disponible
proche (suggestion automatique + validation manuelle), et tout le monde suit
la course en direct sur la carte.

Stack : **Next.js 14 + Supabase (Auth/DB/Realtime) + Tailwind CSS + Leaflet/OpenStreetMap**.
100% outils gratuits pour démarrer — pas de carte bancaire nécessaire.

---

## 1. Créer le projet Supabase (gratuit)

1. Va sur [supabase.com](https://supabase.com) → **New project** (plan Free).
2. Une fois créé, va dans **SQL Editor** → colle tout le contenu de
   `supabase/schema.sql` → **Run**. Ça crée les tables, la sécurité (RLS) et
   la fonction de matching géographique des livreurs.
3. Va dans **Project Settings → API** et note :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Activer la connexion Google (gratuit)

1. Dans Supabase : **Authentication → Providers → Google** → active-le.
2. Il te faut un Client ID / Secret Google OAuth :
   - Va sur [console.cloud.google.com](https://console.cloud.google.com) →
     crée un projet (gratuit) → **APIs & Services → Credentials** →
     **Create Credentials → OAuth client ID** → type **Web application**.
   - Dans **Authorized redirect URIs**, ajoute l'URL de callback que Supabase
     t'affiche sur la page Google Provider (ressemble à
     `https://xxxx.supabase.co/auth/v1/callback`).
   - Copie le Client ID et le Client Secret générés dans les champs Supabase.
3. Dans **Authentication → URL Configuration**, ajoute ton domaine de prod
   (Vercel) dans **Redirect URLs** une fois déployé (ex.
   `https://ton-app.vercel.app/**`).

## 3. Lancer en local

```bash
npm install
cp .env.example .env.local
# Remplis .env.local avec tes clés Supabase (étape 1)
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

## 4. Déployer gratuitement sur Vercel

1. Pousse ce projet sur GitHub (`github.com/AUthENTIQUEyeager`).
2. Sur [vercel.com](https://vercel.com) → **Add New Project** → importe le repo.
3. Ajoute les variables d'environnement (les mêmes que `.env.local`), avec
   `NEXT_PUBLIC_SITE_URL` = l'URL Vercel finale.
4. Déploie. Vercel gère le HTTPS, le CDN et le scaling automatiquement, gratuitement
   pour ce niveau de trafic.
5. N'oublie pas d'ajouter l'URL Vercel dans Supabase (étape 2.3) et dans les
   **Authorized JavaScript origins / redirect URIs** de Google Cloud Console.

---

## Comment ça marche

**Commerçant** (`/commercant/dashboard`) : crée sa boutique (nom → génère une
page publique `/boutique/[slug]`), gère son catalogue, voit ses commandes,
assigne un livreur (les livreurs disponibles les plus proches sont proposés
automatiquement via la fonction SQL `livreurs_proches`, calcul de distance à
vol d'oiseau), suit la livraison en direct.

**Livreur** (`/livreur`) : bascule disponible/hors ligne, sa position GPS est
envoyée en direct (throttlée à 8s pour ménager la batterie et les données
mobiles), reçoit sa course assignée, démarre puis marque comme livrée.

**Client** (`/boutique/[slug]`, page publique, pas de compte requis) : parcourt
le catalogue, ajoute au panier, commande en partageant sa position GPS, suit
ensuite sa livraison en direct sur la même page.

## Sécurité

Toute la sécurité d'accès aux données passe par les policies **Row Level
Security** de Postgres (`supabase/schema.sql`), pas seulement par l'interface :
même avec la clé publique `anon`, un commerçant ne peut jamais lire les
commandes d'un autre commerçant, un livreur ne voit que ses courses assignées,
etc. C'est Postgres qui applique la règle, à chaque requête.

Point de vigilance pour la suite : la commande client est actuellement en
"guest checkout" (pas de compte requis) pour rester simple à l'usage. Si le
volume grossit, on pourra ajouter une vérification par SMS/OTP à la commande
pour limiter les faux numéros.

## Prochaines étapes suggérées

- Upload d'images produits vers Supabase Storage (au lieu de coller une URL).
- Notifications push (ou SMS via une passerelle locale) au commerçant quand
  une commande arrive, et au livreur quand il est assigné.
- Historique et évaluations des livreurs.
- Passage de Supabase Realtime en `postgres_changes` pour un tracking encore
  plus instantané (actuellement en polling toutes les 6-20s, largement
  suffisant pour du MVP et plus économe en requêtes).
