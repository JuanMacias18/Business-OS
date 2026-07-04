import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/");
  await page.getByTestId("email-input").fill(email);
  await page.getByTestId("password-input").fill(password);
  await page.getByTestId("login-button").click();
  await expect(page.getByTestId("tenant-dashboard")).toBeVisible();
  await page.getByTestId("tab-catalogo").click();
  await expect(page.getByTestId("catalog-manager")).toBeVisible();
}

test("admin gestiona su catalogo end-to-end (crear, alternar disponible, borrar)", async ({ page }) => {
  await login(page, "usuario-a@e2e.test", "Test1234!");

  // El catalogo demo del tenant A ya trae 2 productos.
  await expect(page.getByTestId("catalog-list").getByTestId("product-name")).toHaveCount(2);

  // Crear un producto nuevo.
  await page.getByTestId("add-product-form").getByTestId("new-product-name").fill("Producto e2e");
  await page.getByTestId("add-product-form").getByTestId("new-product-price").fill("15000");
  await page.getByTestId("add-product-form").getByTestId("new-product-stock").fill("5");
  await page.getByTestId("add-product-button").click();

  const newRow = page.locator('[data-testid^="product-row-"]', { hasText: "Producto e2e" });
  await expect(newRow).toBeVisible();
  await expect(newRow.getByTestId("product-price")).toHaveText("$15000");

  // Alternar disponible.
  const toggleButton = newRow.locator('[data-testid^="toggle-disponible-"]');
  await expect(toggleButton).toHaveText("disponible");
  await toggleButton.click();
  await expect(toggleButton).toHaveText("no disponible");

  // Borrar el producto.
  await newRow.locator('[data-testid^="delete-product-"]').click();
  await expect(page.locator('[data-testid^="product-row-"]', { hasText: "Producto e2e" })).toHaveCount(0);
});

test("staff ve el catalogo pero no puede agregar ni borrar productos", async ({ page }) => {
  await login(page, "usuario-a-staff@e2e.test", "Test1234!");

  await expect(page.getByTestId("catalog-list").getByTestId("product-name")).toHaveCount(2);
  await expect(page.getByTestId("add-product-form")).toHaveCount(0);
  await expect(page.locator('[data-testid^="delete-product-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="disponible-label-"]').first()).toBeVisible();
});
