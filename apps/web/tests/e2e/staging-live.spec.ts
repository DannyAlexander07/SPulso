import { expect, test } from "@playwright/test";

const adminEmail = process.env.STAGING_ADMIN_EMAIL;
const adminPassword = process.env.STAGING_ADMIN_PASSWORD;
const workerEmail = process.env.STAGING_WORKER_EMAIL;
const workerPassword = process.env.STAGING_WORKER_PASSWORD;
const liveQaEnabled = Boolean(
  process.env.STAGING_LIVE_QA === "true" &&
  adminEmail &&
  adminPassword &&
  workerEmail &&
  workerPassword,
);

test.describe("UAT en staging", () => {
  test.skip(!liveQaEnabled, "Requiere credenciales efimeras de staging.");

  test("administrador ingresa y abre el importador Excel", async ({ page }) => {
    await login(page, adminEmail ?? "", adminPassword ?? "");
    await page.goto("/trabajadores", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Directorio de personas/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Importar Excel" }).click();
    await expect(
      page.getByRole("heading", { name: /Importar trabajadores/i }),
    ).toBeVisible();
    const modalMetrics = await page.getByRole("dialog").evaluate((element) => ({
      bottom: element.getBoundingClientRect().bottom,
      right: element.getBoundingClientRect().right,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    }));
    expect(modalMetrics.right).toBeLessThanOrEqual(modalMetrics.viewportWidth);
    expect(modalMetrics.bottom).toBeLessThanOrEqual(
      modalMetrics.viewportHeight,
    );
  });

  test("trabajador ingresa y ve su portal", async ({ page }) => {
    await login(page, workerEmail ?? "", workerPassword ?? "");
    await page.goto("/portal", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/portal/);
    await expect(page.locator("body")).toContainText(
      /Marcar asistencia|Mis solicitudes|Mi ficha/i,
    );
  });
});

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  const response = await page.request.post("/api/auth/login", {
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();
}
