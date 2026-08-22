export default function CompteBloquePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="card max-w-sm p-6">
        <h1 className="font-display text-xl font-bold text-ink">Compte suspendu</h1>
        <p className="mt-2 text-sm text-ink/60">
          Ton compte a été temporairement bloqué. Contacte le support si tu penses qu&apos;il s&apos;agit d&apos;une erreur.
        </p>
      </div>
    </div>
  );
}
