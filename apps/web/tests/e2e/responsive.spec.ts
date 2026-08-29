import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin, loginAsWorker } from "./helpers";

test("importador Excel mantiene modal y bandeja dentro del viewport", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/trabajadores", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Importar Excel" }).click();

  const dialog = page.getByRole("dialog").first();
  await expect(dialog).toBeVisible();
  await expect(
    page.getByText("Historial de cargas", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Archivo Excel")).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
    viewport?.width ?? 0,
  );
});

test("admin mantiene navegacion usable en movil", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: "Centro operativo" }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText(/Admin SPulso|Grupo SP/i);
  await expectNoHorizontalOverflow(page);
});

test("encabezado administrativo no se superpone con el menu", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/notificaciones", { waitUntil: "domcontentloaded" });

  const menuButton = page.getByRole("button", { name: "Abrir menu" });
  const heading = page.getByRole("heading", {
    name: "Centro de notificaciones",
  });
  await expect(menuButton).toBeVisible();
  await expect(heading).toBeVisible();

  const [menuBox, headingBox] = await Promise.all([
    menuButton.boundingBox(),
    heading.boundingBox(),
  ]);

  expect(menuBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(headingBox!.x);
  await expectNoHorizontalOverflow(page);
});

test("portal trabajador mantiene accesos principales en movil", async ({
  page,
}) => {
  await loginAsWorker(page);
  await page.goto("/portal", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: /Maria Fernanda/i }),
  ).toBeVisible();
  await expect(page.getByText(/Marcar asistencia/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

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
