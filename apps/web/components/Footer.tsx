import { getT } from "../i18n/server";

import { Container } from "./ui/Container";

export default async function Footer() {
  const t = await getT();

  return (
    <footer>
      <Container className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div className="text-sm text-[var(--foreground-muted)]">
          {`${t("footer.copyright", {
            year: new Date().getFullYear(),
            brand: t("common.brand"),
          })} - ${t("footer.tagline")}`}
        </div>

        <div className="text-sm text-[var(--foreground-muted)]">
          <a
            className="transition-colors hover:text-[var(--foreground)]"
            href="https://github.com/ArthurP-fr/Flint"
            rel="noreferrer"
            target="_blank"
          >
            {t("footer.github")}
          </a>
        </div>
      </Container>
    </footer>
  );
}
