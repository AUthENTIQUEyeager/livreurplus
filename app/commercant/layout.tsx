import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavCommercant from "./nav-commercant";

export default async function CommercantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/commercant/dashboard");

  const { data: profil, error } = await supabase
    .from("profiles")
    .select("role, nom")
    .eq("id", user.id)
    .single();

  if (error || profil?.role !== "commercant") {
    console.error(
      "[commercant/layout] Accès refusé —",
      "user connecté:", user.email, `(id: ${user.id})`,
      "| rôle trouvé:", profil?.role ?? "aucun profil",
      "| erreur requête:", error?.message ?? "aucune"
    );
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-mist">
      <NavCommercant nom={profil.nom} />
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
