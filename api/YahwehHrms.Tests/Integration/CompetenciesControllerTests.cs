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

public class CompetenciesControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);

    public CompetenciesControllerTests(CustomWebApplicationFactory factory) => _factory = factory;

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

    private Guid SeedCompetency(Guid tenantId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrmsDbContext>();
        var id = Guid.NewGuid();
        db.Competencies.Add(new Competency { Id = id, TenantId = tenantId, Name = "Leadership", Category = "behavioural", IsActive = true });
        db.SaveChanges();
        return id;
    }

    [Fact]
    public async Task GetAll_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/competencies");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task GetAll_WithValidToken_Returns200AndArray()
    {
        var email = $"comp-{Guid.NewGuid():N}@test.com";
        var (tenantId, _) = SeedUser(email, "Password1!");
        SeedCompetency(tenantId);

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.GetAsync("/api/competencies");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
    }

    [Fact]
    public async Task GetById_ExistingCompetency_Returns200()
    {
        var email = $"comp-id-{Guid.NewGuid():N}@test.com";
        var (tenantId, _) = SeedUser(email, "Password1!");
        var compId = SeedCompetency(tenantId);

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.GetAsync($"/api/competencies/{compId}");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task GetById_NonExistent_Returns404()
    {
        var email = $"comp-404-{Guid.NewGuid():N}@test.com";
        SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var resp = await client.GetAsync($"/api/competencies/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Create_ValidCompetency_Returns201()
    {
        var email = $"comp-create-{Guid.NewGuid():N}@test.com";
        SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var payload = new { name = "Critical Thinking", category = "technical", isActive = true };
        var resp = await client.PostAsync("/api/competencies", Json(payload));

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.True(body.TryGetProperty("id", out _));
    }
}
