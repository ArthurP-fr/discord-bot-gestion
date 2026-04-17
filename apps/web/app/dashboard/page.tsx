import { DashboardClient } from "../../components/dashboard-client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <main className="page-shell">
      <section className="panel panel-dashboard reveal-up">
        <DashboardClient apiBaseUrl={apiBaseUrl} />
      </section>
    </main>
  );
}
