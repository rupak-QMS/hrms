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

public class ComplianceControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);

    public ComplianceControllerTests(CustomWebApplicationFactory factory) => _factory = factory;

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

    private Guid SeedEmployee(Guid tenantId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrmsDbContext>();
        var id = Guid.NewGuid();
        db.Employees.Add(new Employee
        {
            Id = id, TenantId = tenantId, FirstName = "Test", LastName = "User",
            Email = (id.ToString("N")[..8]) + "@seed.com",
            EmployeeNumber = "EMP-" + id.ToString("N")[..6],
            EmploymentType = "full_time", Status = "active",
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow),
        });
        db.SaveChanges();
        return id;
    }

    private Guid SeedCompliance(Guid tenantId, Guid employeeId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrmsDbContext>();
        var id = Guid.NewGuid();
        db.ComplianceTracking.Add(new ComplianceTracking
        {
            Id = id, TenantId = tenantId, EmployeeId = employeeId,
            Requirement = "Test Req", Category = "safety", Status = "pending",
        });
        db.SaveChanges();
        return id;
    }

    [Fact]
    public async Task GetAll_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/compliance");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task GetAll_WithValidToken_Returns200AndArray()
    {
        var email = $"comp-{Guid.NewGuid():N}@test.com";
        var (tenantId, _) = SeedUser(email, "Password1!");
        var empId = SeedEmployee(tenantId);
        SeedCompliance(tenantId, empId);

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.GetAsync("/api/compliance");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
        Assert.True(body.GetArrayLength() >= 1);
    }

    [Fact]
    public async Task GetAll_TenantIsolation_ReturnsOnlyOwnTenantData()
    {
        var emailA = $"comp-a-{Guid.NewGuid():N}@test.com";
        var emailB = $"comp-b-{Guid.NewGuid():N}@test.com";
        var (tenantIdA, _) = SeedUser(emailA, "Password1!");
        var empIdA = SeedEmployee(tenantIdA);
        SeedCompliance(tenantIdA, empIdA);
        SeedUser(emailB, "Password1!");

        var tokenB = await LoginAsync(emailB, "Password1!");
        using var client = AuthClient(tokenB);
        var resp = await client.GetAsync("/api/compliance");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.Equal(0, body.GetArrayLength());
    }

    [Fact]
    public async Task GetById_ExistingRecord_Returns200()
    {
        var email = $"comp-id-{Guid.NewGuid():N}@test.com";
        var (tenantId, _) = SeedUser(email, "Password1!");
        var empId = SeedEmployee(tenantId);
        var recId = SeedCompliance(tenantId, empId);

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.GetAsync($"/api/compliance/{recId}");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task GetById_NonExistent_Returns404()
    {
        var email = $"comp-404-{Guid.NewGuid():N}@test.com";
        SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var resp = await client.GetAsync($"/api/compliance/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Create_ValidRecord_Returns201()
    {
        var email = $"comp-create-{Guid.NewGuid():N}@test.com";
        var (tenantId, _) = SeedUser(email, "Password1!");
        var empId = SeedEmployee(tenantId);

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var payload = new { employeeId = empId, requirement = "WWC Check", category = "safety", status = "pending", dueDate = (string?)null, completedOn = (string?)null, notes = (string?)null };
        var resp = await client.PostAsync("/api/compliance", Json(payload));

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.True(body.TryGetProperty("id", out _));
    }
}
