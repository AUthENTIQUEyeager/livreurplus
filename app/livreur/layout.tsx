import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LivreurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/livreur");

  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profil?.role !== "livreur") redirect("/");

  return <div className="min-h-screen bg-mist">{children}</div>;
}
