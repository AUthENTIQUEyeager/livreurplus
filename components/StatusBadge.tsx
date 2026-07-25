import type { StatutCommande } from "@/lib/types";
import { LABELS_STATUT } from "@/lib/types";

const STYLES: Record<StatutCommande, string> = {
  en_attente: "bg-amber-tint text-amber",
  assignee: "bg-route-tint text-route-dark",
  en_livraison: "bg-route-tint text-route-dark",
  livree: "bg-mist text-ink/60",
  annulee: "bg-danger-tint text-danger",
};

export default function StatusBadge({ statut }: { statut: StatutCommande }) {
  return <span className={`badge ${STYLES[statut]}`}>{LABELS_STATUT[statut]}</span>;
}
