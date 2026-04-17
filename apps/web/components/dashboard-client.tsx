"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";

type User = {
  id: string;
  tenantId: string;
  username: string;
  avatarUrl: string | null;
  role: "owner" | "member";
};

type BotStatus = "stopped" | "starting" | "running" | "stopping" | "error";

type Bot = {
  id: string;
  tenantId: string;
  discordBotId: string;
  displayName: string;
  status: BotStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type DashboardClientProps = {
  apiBaseUrl: string;
};

const statusLabel: Record<BotStatus, string> = {
  stopped: "Arrete",
  starting: "Demarrage",
  running: "En ligne",
  stopping: "Arret",
  error: "Erreur",
};

export function DashboardClient({ apiBaseUrl }: DashboardClientProps) {
  const [user, setUser] = useState<User | null>(null);
  const [bots, setBots] = useState<Bot[]>([]);
  const [token, setToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const meResponse = await fetch(`${apiBaseUrl}/api/me`, {
        credentials: "include",
      });

      if (meResponse.status === 401) {
        setUser(null);
        setBots([]);
        setLoading(false);
        return;
      }

      if (!meResponse.ok) {
        throw new Error("Impossible de recuperer la session utilisateur");
      }

      const meJson = await meResponse.json();
      setUser(meJson.user as User);

      const botsResponse = await fetch(`${apiBaseUrl}/api/bots`, {
        credentials: "include",
      });

      if (!botsResponse.ok) {
        throw new Error("Impossible de recuperer la liste des bots");
      }

      const botsJson = await botsResponse.json();
      setBots((botsJson.bots ?? []) as Bot[]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Erreur inattendue";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const handleLogout = async () => {
    await fetch(`${apiBaseUrl}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    setUser(null);
    setBots([]);
  };

  const handleAddBot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/bots`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          displayName: displayName.trim().length > 0 ? displayName : undefined,
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error ?? "Ajout du bot impossible");
      }

      setToken("");
      setDisplayName("");
      await refreshData();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Erreur inattendue";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const triggerAction = async (botId: string, action: "start" | "stop" | "restart") => {
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/bots/${botId}/${action}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error ?? `Action ${action} impossible`);
      }

      await refreshData();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Erreur inattendue";
      setError(message);
    }
  };

  if (loading) {
    return <p className="muted">Chargement du dashboard...</p>;
  }

  if (!user) {
    return (
      <div className="stack">
        <p className="eyebrow">Session requise</p>
        <h1>Connexion necessaire</h1>
        <p>Ton dashboard est protege. Connecte-toi via Discord pour administrer tes bots.</p>
        <a className="button-primary" href={`${apiBaseUrl}/auth/discord/login`}>
          Se connecter
        </a>
      </div>
    );
  }

  return (
    <div className="stack">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Tenant {user.tenantId}</p>
          <h1>{user.username}</h1>
          <p className="muted">Role: {user.role}</p>
        </div>
        <button className="button-ghost" onClick={handleLogout} type="button">
          Se deconnecter
        </button>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="card-grid">
        <article className="card add-bot-card">
          <h2>Ajouter un bot</h2>
          <p>Le token est verifie cote API puis chiffre avant stockage en base.</p>
          <form className="stack-tight" onSubmit={handleAddBot}>
            <label>
              Token bot Discord
              <input
                autoComplete="off"
                name="token"
                onChange={(event) => setToken(event.target.value)}
                placeholder="MTIz..."
                required
                type="password"
                value={token}
              />
            </label>
            <label>
              Nom d'affichage (optionnel)
              <input
                name="displayName"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Bot support EU"
                type="text"
                value={displayName}
              />
            </label>
            <button className="button-primary" disabled={submitting} type="submit">
              {submitting ? "Validation en cours..." : "Ajouter le bot"}
            </button>
          </form>
        </article>

        <article className="card bots-card">
          <div className="row-between">
            <h2>Mes bots</h2>
            <button className="button-ghost" onClick={() => void refreshData()} type="button">
              Rafraichir
            </button>
          </div>

          {bots.length === 0 ? (
            <p className="muted">Aucun bot pour ce tenant.</p>
          ) : (
            <ul className="bot-list">
              {bots.map((bot) => (
                <li className="bot-item" key={bot.id}>
                  <div className="bot-main">
                    <p className="bot-name">{bot.displayName}</p>
                    <p className="muted mono">Discord ID: {bot.discordBotId}</p>
                    <p className={`status status-${bot.status}`}>{statusLabel[bot.status]}</p>
                    {bot.lastError ? <p className="error-inline">Derniere erreur: {bot.lastError}</p> : null}
                  </div>
                  <div className="actions">
                    <button onClick={() => void triggerAction(bot.id, "start")} type="button">
                      Start
                    </button>
                    <button onClick={() => void triggerAction(bot.id, "stop")} type="button">
                      Stop
                    </button>
                    <button onClick={() => void triggerAction(bot.id, "restart")} type="button">
                      Restart
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
