using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using YahwehHrms.Core.Entities;
using YahwehHrms.Infrastructure.Data;

namespace YahwehHrms.Tests.Integration;

public class DashboardControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);

    public DashboardControllerTests(CustomWebApplicationFactory factory) => _factory = factory;

    private static StringContent Json(object obj) =>
        new(JsonSerializer.Serialize(obj), Encoding.UTF8, "application/json");

    private (Guid tenantId, Guid userId) SeedUser(string email, string password, string role = "hr_officer")
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrmsDbContext>();
        var tenantId = Guid.NewGuid();
        db.Tenants.Add(new Tenant { Id = tenantId, Name = "T-" + tenantId, Subdomain = "t-" + tenantId, IsActive = true });
        var userId = Guid.NewGuid();
        db.Users.Add(new User { Id = userId, TenantId = tenantId, Email = email, PasswordHash = BCrypt.Net.BCrypt.HashPassword(password), Role = role, IsActive = true });
        db.SaveChanges();
        return (tenantId, userId);
    }

    private async Task<string> LoginAsync(string email, string password)
    {
        using var client = _factory.CreateClient();
        var resp = await client.PostAsync("/api/auth/login", Json(new { email, password }));
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        return body.GetProperty("token").GetString()!;
    }

    private HttpClient AuthClient(string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task GetStats_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/dashboard/stats");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task GetStats_WithValidToken_Returns200WithExpectedKeys()
    {
        var email = $"dash-{Guid.NewGuid():N}@test.com";
        SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var resp = await client.GetAsync("/api/dashboard/stats");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.True(body.TryGetProperty("totalActiveEmployees", out _));
        Assert.True(body.TryGetProperty("activeContracts", out _));
        Assert.True(body.TryGetProperty("openJobRequisitions", out _));
        Assert.True(body.TryGetProperty("openWhsIncidents", out _));
        Assert.True(body.TryGetProperty("unreadNotifications", out _));
    }

    [Fact]
    public async Task GetStats_FreshTenant_ReturnsZeroCounts()
    {
        var email = $"dash-zero-{Guid.NewGuid():N}@test.com";
        SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var resp = await client.GetAsync("/api/dashboard/stats");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.Equal(0, body.GetProperty("totalActiveEmployees").GetInt32());
        Assert.Equal(0, body.GetProperty("activeContracts").GetInt32());
    }
}
