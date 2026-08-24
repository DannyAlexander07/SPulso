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

  const uploadResponse = await page.request.post(
    "/api/spulso/archivos/documentos",
    {
      multipart: {
        file: {
          name: "documento-regresion.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from(
            "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
          ),
        },
      },
    },
  );
  expect(uploadResponse.ok()).toBeTruthy();
  const uploaded = (await uploadResponse.json()) as {
    fileName: string;
    mimeType: string;
    url: string;
  };

  const title = `Documento regresion ${Date.now()}`;
  const createResponse = await page.request.post("/api/spulso/documentos", {
    data: {
      employeeId,
      expiresAt: "2099-12-31",
      fileName: uploaded.fileName,
      fileUrl: uploaded.url,
      mimeType: uploaded.mimeType,
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

    const downloadLink = card.getByRole("link", { name: /Abrir/i });
    await expect(downloadLink).toHaveAttribute("href", `/api/spulso${uploaded.url}`);
  } finally {
    await page.request.delete(`/api/spulso/documentos/${created.id}`);
  }
});

test("organizacion aprovecha el ancho disponible sin desplazarse a la derecha", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await loginAsAdmin(page);
  await page.goto("/organizacion", { waitUntil: "domcontentloaded" });

  const workspace = page
    .getByRole("heading", { name: /Ordena personas en areas/i })
    .locator('xpath=ancestor::div[contains(@class, "pb-24")][1]');
  const workspaceBox = await workspace.boundingBox();

  expect(workspaceBox).not.toBeNull();
  expect(workspaceBox!.x).toBeLessThan(360);
  expect(workspaceBox!.width).toBeGreaterThanOrEqual(1500);
  expect(workspaceBox!.x + workspaceBox!.width).toBeLessThanOrEqual(1920);

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
