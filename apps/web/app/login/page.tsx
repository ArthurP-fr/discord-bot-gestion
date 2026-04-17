const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function LoginPage() {
  return (
    <main className="page-shell">
      <section className="panel panel-login reveal-up">
        <p className="eyebrow">Discord Bot SaaS Platform</p>
        <h1>Connecte ton compte Discord</h1>
        <p>
          Authentifie-toi via OAuth2 pour accéder à ton espace multi-tenant et piloter les bots de ton
          organisation.
        </p>
        <a className="button-primary" href={`${apiBaseUrl}/auth/discord/login`}>
          Continuer avec Discord
        </a>
      </section>
    </main>
  );
}
