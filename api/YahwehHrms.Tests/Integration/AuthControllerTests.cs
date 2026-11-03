using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using YahwehHrms.Core.Entities;
using YahwehHrms.Infrastructure.Data;

namespace YahwehHrms.Tests.Integration;

public class AuthControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);

    public AuthControllerTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client  = factory.CreateClient();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static StringContent JsonContent(object obj) =>
        new(JsonSerializer.Serialize(obj), Encoding.UTF8, "application/json");

    private void SeedUser(string email, string password, string role = "employee")
    {
        using var scope = _factory.Services.CreateScope();
        var db          = scope.ServiceProvider.GetRequiredService<HrmsDbContext>();

        if (db.Users.Any(u => u.Email == email)) return;

        var tenantId = Guid.NewGuid();
        db.Tenants.Add(new Tenant
        {
            Id       = tenantId,
            Name     = "Test Tenant " + tenantId,
            Subdomain = "test-" + tenantId,
            IsActive = true,
        });

        db.Users.Add(new User
        {
            Id           = Guid.NewGuid(),
            TenantId     = tenantId,
            Email        = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role         = role,
            IsActive     = true,
        });

        db.SaveChanges();
    }

    // ── POST /api/auth/login ─────────────────────────────────────────────────

    [Fact]
    public async Task Login_ValidCredentials_Returns200WithToken()
    {
        SeedUser("valid@test.com", "Password123!");

        var resp = await _client.PostAsync("/api/auth/login",
            JsonContent(new { email = "valid@test.com", password = "Password123!" }));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.True(body.TryGetProperty("token", out var token));
        Assert.False(string.IsNullOrWhiteSpace(token.GetString()));
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401()
    {
        SeedUser("wrongpw@test.com", "CorrectPassword!");

        var resp = await _client.PostAsync("/api/auth/login",
            JsonContent(new { email = "wrongpw@test.com", password = "WrongPassword!" }));

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Login_MissingEmail_Returns400()
    {
        var resp = await _client.PostAsync("/api/auth/login",
            JsonContent(new { password = "SomePassword!" }));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Login_MissingPassword_Returns400()
    {
        var resp = await _client.PostAsync("/api/auth/login",
            JsonContent(new { email = "nopw@test.com" }));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    // ── GET /api/auth/me ─────────────────────────────────────────────────────

    [Fact]
    public async Task Me_WithoutToken_Returns401()
    {
        var resp = await _client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Me_WithValidToken_Returns200()
    {
        SeedUser("me@test.com", "Password123!");

        var loginResp = await _client.PostAsync("/api/auth/login",
            JsonContent(new { email = "me@test.com", password = "Password123!" }));
        loginResp.EnsureSuccessStatusCode();

        var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>(_json);
        var token     = loginBody.GetProperty("token").GetString()!;

        using var authClient = _factory.CreateClient();
        authClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var meResp = await authClient.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, meResp.StatusCode);
    }
}
