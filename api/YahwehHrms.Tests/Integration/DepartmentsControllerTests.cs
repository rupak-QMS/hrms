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

public class DepartmentsControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);

    public DepartmentsControllerTests(CustomWebApplicationFactory factory) => _factory = factory;

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

    private Guid SeedDepartment(Guid tenantId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrmsDbContext>();
        var id = Guid.NewGuid();
        db.Departments.Add(new Department { Id = id, TenantId = tenantId, Name = "HR", Code = "HR-" + id.ToString("N")[..4], IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        db.SaveChanges();
        return id;
    }

    [Fact]
    public async Task GetAll_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/departments");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task GetAll_WithValidToken_Returns200AndArray()
    {
        var email = $"dept-{Guid.NewGuid():N}@test.com";
        var (tenantId, _) = SeedUser(email, "Password1!");
        SeedDepartment(tenantId);

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.GetAsync("/api/departments");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
        Assert.True(body.GetArrayLength() >= 1);
    }

    [Fact]
    public async Task GetById_ExistingDepartment_Returns200()
    {
        var email = $"dept-id-{Guid.NewGuid():N}@test.com";
        var (tenantId, _) = SeedUser(email, "Password1!");
        var deptId = SeedDepartment(tenantId);

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.GetAsync($"/api/departments/{deptId}");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.Equal(deptId.ToString(), body.GetProperty("id").GetString());
    }

    [Fact]
    public async Task GetById_NonExistent_Returns404()
    {
        var email = $"dept-404-{Guid.NewGuid():N}@test.com";
        SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var resp = await client.GetAsync($"/api/departments/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Create_ValidDepartment_Returns201()
    {
        var email = $"dept-create-{Guid.NewGuid():N}@test.com";
        SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var payload = new { name = "Engineering", code = "ENG-001", description = (string?)null, managerId = (Guid?)null, parentId = (Guid?)null };
        var resp = await client.PostAsync("/api/departments", Json(payload));

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.True(body.TryGetProperty("id", out _));
    }

    [Fact]
    public async Task Update_ExistingDepartment_Returns204()
    {
        var email = $"dept-upd-{Guid.NewGuid():N}@test.com";
        var (tenantId, _) = SeedUser(email, "Password1!");
        var deptId = SeedDepartment(tenantId);

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var payload = new { name = "Updated HR", code = "HR-UPD", description = (string?)null, managerId = (Guid?)null, parentId = (Guid?)null, isActive = true };
        var resp = await client.PutAsync($"/api/departments/{deptId}", Json(payload));

        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);
    }
}
