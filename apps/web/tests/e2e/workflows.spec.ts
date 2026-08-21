import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginAsWorker } from "./helpers";

test("admin puede descargar una exportacion de trabajadores", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/trabajadores", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: /Directorio de personas/i })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Exportar Excel/i }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/spulso-trabajadores.*\.csv$/);
});

test("portal trabajador muestra accesos y permite abrir marcacion", async ({ page }) => {
  await loginAsWorker(page);
  await page.goto("/portal", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: /Maria Fernanda/i })).toBeVisible();
  await page.getByRole("link", { name: /Marcar asistencia/i }).click();

  await expect(page).toHaveURL(/\/portal\/marcacion|\/marcacion/);
  await expect(page.locator("body")).toContainText(/GPS|ubicacion|ubicación|jornada|asistencia/i);
});

test("formulario de login muestra error con credenciales invalidas", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Correo").fill("admin@spulso.local");
  await page.getByLabel("Contraseña").fill("clave-incorrecta");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page.locator("form")).toContainText(/credenciales|sesion|sesión|contraseña|password/i);
});
