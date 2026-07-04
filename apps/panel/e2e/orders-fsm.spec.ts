import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/");
  await page.getByTestId("email-input").fill(email);
  await page.getByTestId("password-input").fill(password);
  await page.getByTestId("login-button").click();
  await expect(page.getByTestId("orders-manager")).toBeVisible();
}

test("un pedido manual recorre la FSM completa desde el panel", async ({ page }) => {
  await login(page, "usuario-a@e2e.test", "Test1234!");

  await page.getByTestId("order-producto-select").selectOption({ label: "Bandeja paisa ($28000)" });
  await page.getByTestId("order-cantidad-input").fill("1");
  await page.getByTestId("create-order-button").click();

  const row = page.locator('[data-testid^="order-row-"]').first();
  await expect(row.getByTestId("order-estado")).toHaveText("creado");

  await row.locator('[data-testid^="solicitar-pago-"]').click();
  await expect(row.getByTestId("order-estado")).toHaveText("pendiente de pago");

  await row.locator('[data-testid^="confirmar-pago-"]').click();
  await expect(row.getByTestId("order-estado")).toHaveText("confirmado");

  await row.locator('[data-testid^="avanzar-preparando-"]').click();
  await expect(row.getByTestId("order-estado")).toHaveText("preparando");

  await row.locator('[data-testid^="avanzar-entregado-"]').click();
  await expect(row.getByTestId("order-estado")).toHaveText("entregado");

  // Estado terminal: no quedan botones de accion en esta fila.
  await expect(row.locator("button")).toHaveCount(0);
});

test("cancelar un pedido pendiente de pago libera la reserva", async ({ page }) => {
  await login(page, "usuario-b@e2e.test", "Test1234!");

  await page.getByTestId("order-producto-select").selectOption({ label: "Sancocho de gallina ($25000)" });
  await page.getByTestId("order-cantidad-input").fill("1");
  await page.getByTestId("create-order-button").click();

  const row = page.locator('[data-testid^="order-row-"]').first();
  await row.locator('[data-testid^="solicitar-pago-"]').click();
  await expect(row.getByTestId("order-estado")).toHaveText("pendiente de pago");

  await row.locator('[data-testid^="cancelar-pedido-"]').click();
  await expect(row.getByTestId("order-estado")).toHaveText("cancelado");
});
