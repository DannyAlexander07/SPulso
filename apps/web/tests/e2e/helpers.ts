import { expect, type Page } from "@playwright/test";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const browserBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const tokenCache = new Map<string, string>();

export async function loginAs(page: Page, email: string, password: string) {
  const cacheKey = `${email}:${password}`;
  let token = tokenCache.get(cacheKey);

  if (!token) {
    const response = await page.request.post(`${apiUrl}/auth/login`, {
      data: { email, password },
    });

    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as { accessToken?: string };
    if (!body.accessToken) {
      throw new Error(`No se recibio token para ${email}`);
    }

    token = body.accessToken;
    tokenCache.set(cacheKey, token);
  }

  await page.context().addCookies([
    {
      httpOnly: true,
      name: "spulso_token",
      sameSite: "Lax",
      url: browserBaseUrl,
      value: token,
    },
  ]);
}

export async function loginAsAdmin(page: Page) {
  await loginAs(page, "admin@spulso.local", "Admin1234.");
  await page.goto("/seleccionar-panel", { waitUntil: "domcontentloaded" });
}

export async function loginAsWorker(page: Page) {
  await loginAs(page, "trabajador@spulso.local", "Trabajador123.");
  await page.goto("/portal", { waitUntil: "domcontentloaded" });
}
