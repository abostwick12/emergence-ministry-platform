import { expect, type Page, test } from "@playwright/test";

test.describe("Meridian personal AI OAuth", () => {
  test("publishes OAuth discovery and challenges unauthenticated MCP clients", async ({ request }) => {
    const metadataResponse = await request.get("/.well-known/oauth-protected-resource");
    expect(metadataResponse.ok()).toBeTruthy();
    await expect(metadataResponse.json()).resolves.toMatchObject({
      resource: "http://localhost:3000/mcp",
      scopes_supported: ["openid", "email", "profile"]
    });

    const mcpResponse = await request.post("/mcp", { data: { jsonrpc: "2.0", id: 1, method: "initialize" } });
    expect(mcpResponse.status()).toBe(401);
    expect(mcpResponse.headers()["www-authenticate"]).toContain("resource_metadata=");
  });

  test("shows the governed Codex connection steps in Settings", async ({ page }) => {
    await login(page);
    await page.goto("/settings#meridian-personal-ai");

    const panel = page.getByRole("region", { name: "Bring Codex to Meridian" });
    await expect(panel).toContainText("Grant Meridian access");
    await expect(panel).toContainText("Add the MCP server in Codex");
    await expect(panel).toContainText("Approve the secure sign-in");
    await expect(panel).toContainText("Raw private notes stay excluded");
    await expect(panel.getByText("http://localhost:3000/mcp")).toBeVisible();
  });

  test("shows explicit consent boundaries before authorizing a client", async ({ page }) => {
    await login(page);
    await page.route("**/api/oauth/consent?**", async (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authorizationId: "request-123",
        client: { id: "codex-client", name: "Codex", uri: "https://chatgpt.com" },
        accountEmail: "leader@example.com",
        scopes: ["openid", "email", "profile"],
        redirectUri: "http://localhost/callback"
      })
    }));

    await page.goto("/oauth/consent?authorization_id=request-123");
    await expect(page.getByRole("heading", { name: "Allow Codex to use Meridian?" })).toBeVisible();
    await expect(page.getByText("Read raw private notes, pastoral records, or unapproved Obsidian material.")).toBeVisible();
    await expect(page.getByText("Approve, publish, send, or represent a draft as church doctrine.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Deny" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Allow connection" })).toBeVisible();
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("staff@example.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
