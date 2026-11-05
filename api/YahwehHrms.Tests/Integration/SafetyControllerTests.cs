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

public class SafetyControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);

    public SafetyControllerTests(CustomWebApplicationFactory factory) => _factory = factory;

    private static StringContent Json(object obj) =>
        new(JsonSerializer.Serialize(obj), Encoding.UTF8, "application/json");

    private (Guid tenantId, Guid userId) SeedUser(string email, string password)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrmsDbContext>();
        var tenantId = Guid.NewGuid();
        db.Tenants.Add(new Tenant { Id = tenantId, Name = "T-" + tenantId, Subdomain = "t-" + tenantId, IsActive = true });
        var userId = Guid.NewGuid();
        db.Users.Add(new User { Id = userId, TenantId = tenantId, Email = email, PasswordHash = BCrypt.Net.BCrypt.HashPassword(password), Role = "hr_officer", IsActive = true });
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

    private Guid SeedIncident(Guid tenantId, Guid reportedBy)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrmsDbContext>();
        var id = Guid.NewGuid();
        db.WhsIncidents.Add(new WhsIncident
        {
            Id = id, TenantId = tenantId, ReportedBy = reportedBy,
            OccurredAt = DateTimeOffset.UtcNow, Type = "near-miss", Severity = "low",
            Location = "Warehouse", Description = "Test incident", Status = "open"
        });
        db.SaveChanges();
        return id;
    }

    [Fact]
    public async Task GetAll_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/whs-incidents");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task GetAll_WithValidToken_Returns200AndArray()
    {
        var email = $"whs-{Guid.NewGuid():N}@test.com";
        var (tenantId, userId) = SeedUser(email, "Password1!");
        SeedIncident(tenantId, userId);

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.GetAsync("/api/whs-incidents");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
    }

    [Fact]
    public async Task GetById_ExistingIncident_Returns200()
    {
        var email = $"whs-id-{Guid.NewGuid():N}@test.com";
        var (tenantId, userId) = SeedUser(email, "Password1!");
        var incId = SeedIncident(tenantId, userId);

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.GetAsync($"/api/whs-incidents/{incId}");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task GetById_NonExistent_Returns404()
    {
        var email = $"whs-404-{Guid.NewGuid():N}@test.com";
        SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var resp = await client.GetAsync($"/api/whs-incidents/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Create_ValidIncident_Returns201()
    {
        var email = $"whs-create-{Guid.NewGuid():N}@test.com";
        var (tenantId, userId) = SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var payload = new
        {
            reportedBy = userId, occurredAt = DateTimeOffset.UtcNow,
            type = "near-miss", severity = "low", location = "Office",
            description = "Slipped on wet floor", status = "open"
        };
        var resp = await client.PostAsync("/api/whs-incidents", Json(payload));

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.True(body.TryGetProperty("id", out _));
    }
}
