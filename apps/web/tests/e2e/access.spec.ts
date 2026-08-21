import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginAsWorker } from "./helpers";

test("admin puede entrar al selector y al panel administrativo", async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page).toHaveURL(/\/seleccionar-panel|\/$/);

  if (page.url().includes("/seleccionar-panel")) {
    await expect(page.getByText("Panel administrativo")).toBeVisible();
    await page.getByRole("link", { name: /Entrar/i }).first().click();
  }

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Centro operativo" })).toBeVisible();
});

test("trabajador no puede abrir una ruta administrativa directa", async ({ page }) => {
  await loginAsWorker(page);

  await page.goto("/usuarios", { waitUntil: "domcontentloaded" });

  await expect(page).not.toHaveURL(/\/usuarios/);
  await expect(page.locator("body")).toContainText(/Portal trabajador|Panel administrativo|Maria Fernanda/i);
});

test("admin sin permiso de ruta invalida vuelve a una zona permitida", async ({ page }) => {
  await loginAsAdmin(page);

  await page.goto("/portal", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/portal|\/seleccionar-panel|\/$/);
  await expect(page.locator("body")).toContainText(/SPulso|Maria|Admin/);
});
