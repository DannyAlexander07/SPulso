import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const pages = [
  {
    heading: "Directorio de personas",
    path: "/trabajadores?porPagina=5",
  },
  {
    heading: "Documentos laborales",
    path: "/documentos?porPagina=5",
  },
  {
    heading: "Solicitudes recientes",
    path: "/solicitudes?porPagina=5",
  },
  {
    heading: "Eventos recientes",
    path: "/auditoria?porPagina=10",
  },
  {
    heading: "Trabajo que el sistema detecta por ti",
    path: "/notificaciones",
  },
];

test.describe("modulos grandes con cursor", () => {
  test.describe.configure({ timeout: 120_000 });

  test("cargan sin errores visuales y muestran controles de cursor", async ({
    page,
  }) => {
    await ensureAdminSession(page);

    for (const item of pages) {
      await gotoAdminPage(page, item.path);

      await expect(
        page.getByRole("heading", { name: item.heading }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Primera pagina/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Siguiente/i }),
      ).toBeVisible();
      await expect(page.locator("body")).not.toContainText(
        /Application error|Unhandled Runtime Error/i,
      );
      await expectNoHorizontalOverflow(page);
    }
  });

  test("mantienen filtros principales con paginacion por cursor", async ({
    page,
  }) => {
    await ensureAdminSession(page);

    const filteredPages = [
      {
        heading: "Directorio de personas",
        path: "/trabajadores?estado=ACTIVE&porPagina=5",
      },
      {
        heading: "Documentos laborales",
        path: "/documentos?estado=PENDING_SIGNATURE&porPagina=5",
      },
      {
        heading: "Solicitudes recientes",
        path: "/solicitudes?estado=PENDING&porPagina=5",
      },
      {
        heading: "Eventos recientes",
        path: "/auditoria?actor=system&porPagina=10",
      },
      {
        heading: "Trabajo que el sistema detecta por ti",
        path: "/notificaciones?estado=UNREAD",
      },
    ];

    for (const item of filteredPages) {
      await gotoAdminPage(page, item.path);

      await expect(
        page.getByRole("heading", { name: item.heading }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Primera pagina/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Siguiente/i }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("permite avanzar por cursor cuando hay siguiente pagina", async ({
    page,
  }) => {
    await ensureAdminSession(page);
    await gotoAdminPage(page, "/trabajadores?porPagina=5");

    const nextLink = page.getByRole("link", { name: /Siguiente/i });
    await expect(nextLink).toBeVisible();

    if ((await nextLink.getAttribute("aria-disabled")) !== "true") {
      await nextLink.click();
      await expect(page).toHaveURL(/\/trabajadores\?.*cursor=/);
      await expect(
        page.getByRole("heading", { name: "Directorio de personas" }),
      ).toBeVisible();

      await page.getByRole("link", { name: /Primera pagina/i }).click();
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === "/trabajadores" && !url.searchParams.has("cursor"),
      );
    }
  });

  test("exporta trabajadores, documentos y solicitudes desde listas cursor", async ({
    page,
  }) => {
    await ensureAdminSession(page);

    await expectDownload(
      page,
      "/trabajadores?porPagina=5",
      /spulso-trabajadores.*\.csv$/,
    );
    await expectDownload(
      page,
      "/documentos?porPagina=5",
      /spulso-documentos.*\.csv$/,
    );
    await expectDownload(
      page,
      "/solicitudes?porPagina=5",
      /spulso-solicitudes.*\.csv$/,
    );
  });

  test("genera reportes en segundo plano desde listas grandes", async ({
    page,
  }) => {
    await ensureAdminSession(page);
    await gotoAdminPage(page, "/trabajadores?estado=ACTIVE&porPagina=5");

    await expect(
      page.getByRole("button", { name: /Reporte en segundo plano/i }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /Reporte en segundo plano/i })
      .click();
    await expect(page.locator("body")).toContainText(/filas listas/i);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Descargar reporte/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(
      /spulso-trabajadores.*\.csv$/,
    );

    await gotoAdminPage(page, "/reportes");
    await expect(
      page.getByRole("heading", { name: "Mis reportes" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Reportes generados" }),
    ).toBeVisible();
    await expect(page.locator("body")).toContainText(/Trabajadores/i);
    await expect(
      page.getByRole("button", { name: /Descargar/i }).first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("notificaciones permite alternar estado leida/no leida", async ({
    page,
  }) => {
    await ensureAdminSession(page);
    await gotoAdminPage(page, "/notificaciones?estado=UNREAD");

    await expect(
      page.getByRole("heading", {
        name: "Trabajo que el sistema detecta por ti",
      }),
    ).toBeVisible();

    const toggleButton = page
      .getByRole("button", { name: /Marcar leida|Marcar no leida/i })
      .first();

    if ((await toggleButton.count()) > 0) {
      const label = await toggleButton.innerText();
      await toggleButton.click();

      await expect(
        page
          .getByRole("button", {
            name: label.includes("no leida")
              ? /Marcar leida/i
              : /Marcar no leida/i,
          })
          .first(),
      ).toBeVisible();
    }
  });
});

async function expectDownload(
  page: Page,
  path: string,
  filenamePattern: RegExp,
) {
  await gotoAdminPage(page, path);
  await expect(
    page.getByRole("button", { name: /Exportar Excel/i }),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Exportar Excel/i }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(filenamePattern);
}

async function ensureAdminSession(page: Page) {
  await loginAsAdmin(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  if (page.url().includes("/login")) {
    await loginAsAdmin(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
  }

  if (page.url().includes("/seleccionar-panel")) {
    await page
      .getByRole("link", { name: /Entrar/i })
      .first()
      .click();
  }

  await expect(page.locator("body")).toContainText(
    /Centro operativo|Admin SPulso|Grupo SP/i,
  );
}

async function gotoAdminPage(page: Page, path: string) {
  await page.goto(path, { timeout: 60_000, waitUntil: "domcontentloaded" });

  if (await isLoginScreen(page)) {
    await ensureAdminSession(page);
    await page.goto(path, { timeout: 60_000, waitUntil: "domcontentloaded" });
  }
}

async function isLoginScreen(page: Page) {
  if (page.url().includes("/login")) {
    return true;
  }

  return (
    (await page
      .getByRole("heading", { name: /Bienvenido de nuevo/i })
      .count()) > 0
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(
    sizes.scrollWidth,
    `scrollWidth=${sizes.scrollWidth}, clientWidth=${sizes.clientWidth}`,
  ).toBeLessThanOrEqual(sizes.clientWidth + 2);
}
