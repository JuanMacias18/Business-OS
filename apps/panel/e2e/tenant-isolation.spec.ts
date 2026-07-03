import { test, expect } from "@playwright/test";

const USERS = {
  a: { email: "usuario-a@e2e.test", password: "Test1234!", tenantName: "Restaurante A (e2e)" },
  b: { email: "usuario-b@e2e.test", password: "Test1234!", tenantName: "Restaurante B (e2e)" },
};

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/");
  await page.getByTestId("email-input").fill(email);
  await page.getByTestId("password-input").fill(password);
  await page.getByTestId("login-button").click();
  await expect(page.getByTestId("tenant-dashboard")).toBeVisible();
}

test("usuario A ve el nombre de su propio tenant", async ({ page }) => {
  await login(page, USERS.a.email, USERS.a.password);
  await expect(page.getByTestId("tenant-name")).toHaveText(USERS.a.tenantName);
});

test("usuario B ve el nombre de su propio tenant, no el de A", async ({ page }) => {
  await login(page, USERS.b.email, USERS.b.password);
  await expect(page.getByTestId("tenant-name")).toHaveText(USERS.b.tenantName);
  await expect(page.getByTestId("tenant-name")).not.toHaveText(USERS.a.tenantName);
});

test("manipular la URL no revela el tenant de otro usuario", async ({ page }) => {
  await login(page, USERS.a.email, USERS.a.password);
  await expect(page.getByTestId("tenant-name")).toHaveText(USERS.a.tenantName);

  // Intento de ataque: forzar un query param que "sugiere" el tenant
  // de otro usuario. La app no lee tenant desde la URL -- la
  // resolucion sale exclusivamente del JWT (03-02 §3) -- asi que
  // esto no debe cambiar nada.
  await page.goto("/?tenant_id=e2e00000-0000-0000-0000-00000000000b&tenant=Restaurante+B");
  await expect(page.getByTestId("tenant-dashboard")).toBeVisible();
  await expect(page.getByTestId("tenant-name")).toHaveText(USERS.a.tenantName);
  await expect(page.getByTestId("tenant-name")).not.toHaveText(USERS.b.tenantName);
});

test("sin sesion, se muestra el formulario de login, no datos de ningun tenant", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("login-button")).toBeVisible();
  await expect(page.getByTestId("tenant-dashboard")).not.toBeVisible();
});
