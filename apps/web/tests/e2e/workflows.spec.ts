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

test("documentos publicados usan la ruta web y conservan la fecha de calendario", async ({ page }) => {
  await loginAsAdmin(page);

  const employeesResponse = await page.request.get(
    "/api/spulso/trabajadores?pageSize=1",
  );
  expect(employeesResponse.ok()).toBeTruthy();

  const employeesBody = (await employeesResponse.json()) as {
    data?: Array<{ id: string }>;
  };
  const employeeId = employeesBody.data?.[0]?.id;
  expect(employeeId).toBeTruthy();

  const title = `Documento regresion ${Date.now()}`;
  const createResponse = await page.request.post("/api/spulso/documentos", {
    data: {
      employeeId,
      expiresAt: "2099-12-31",
      fileName: "documento-regresion.pdf",
      fileUrl: "/uploads/documentos/documento-regresion.pdf",
      mimeType: "application/pdf",
      status: "DRAFT",
      title,
      type: "OTHER",
      visibleToEmployee: false,
    },
  });
  expect(createResponse.ok()).toBeTruthy();

  const created = (await createResponse.json()) as { id: string };

  try {
    await page.goto(`/documentos?buscar=${encodeURIComponent(title)}`, {
      waitUntil: "domcontentloaded",
    });

    const card = page.locator("article").filter({ hasText: title });
    await expect(card).toContainText(/vence 31 dic\. 2099/i);

    const downloadLink = card.getByRole("link", { name: /Descargar/i });
    await expect(downloadLink).toHaveAttribute(
      "href",
      "/api/spulso/uploads/documentos/documento-regresion.pdf",
    );
  } finally {
    await page.request.delete(`/api/spulso/documentos/${created.id}`);
  }
});
