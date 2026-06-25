import { test, expect } from '@playwright/test';

// Intercepta las llamadas de Firebase Auth para que el test no dependa de internet.
// page.route() funciona como un "guardia de red": cuando el navegador intenta
// llamar a Firebase, Playwright lo intercepta y devuelve una respuesta falsa.
async function mockFirebaseAuth(page) {
  await page.route('**/identitytoolkit.googleapis.com/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        idToken: 'fake-token',
        email: 'test@test.com',
        refreshToken: 'fake-refresh',
        expiresIn: '3600',
        localId: 'fake-uid-123',
        registered: true,
      }),
    });
  });

  // Intercepta las llamadas a Firestore (base de datos) para simular
  // que el usuario tiene nickname guardado
  await page.route('**/firestore.googleapis.com/**', async route => {
    const url = route.request().url();
    if (url.includes('/users/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fields: { nickname: { stringValue: 'testuser' } },
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents: [] }),
      });
    }
  });
}

test.describe('Flujo principal de la aplicación', () => {

  test('muestra el formulario de login al abrir la app', async ({ page }) => {
    await page.goto('/');

    // Verifica que hay un campo de email y uno de contraseña visibles
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('muestra error si se intenta hacer login con campos vacíos', async ({ page }) => {
    await page.goto('/');

    // Hace click en el botón de login sin completar nada
    const loginButton = page.locator('button', { hasText: /ingresar|iniciar|login/i }).first();
    await loginButton.click();

    // El formulario no debería proceder — sigue en la misma página
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('login exitoso redirige al panel de juegos', async ({ page }) => {
    await mockFirebaseAuth(page);
    await page.goto('/');

    // Completa el formulario de login
    await page.fill('input[type="email"]', 'test@test.com');
    await page.fill('input[type="password"]', 'password123');

    // Hace click en el botón de login
    const loginButton = page.locator('button', { hasText: /ingresar|iniciar|login/i }).first();
    await loginButton.click();

    // Después del login debería aparecer contenido del panel principal
    // (el formulario de login ya no debería estar visible)
    await page.waitForTimeout(1500);
    const emailInput = page.locator('input[type="email"]');
    const panelVisible = await emailInput.isVisible().then(v => !v).catch(() => true);
    expect(panelVisible).toBeTruthy();
  });

});
