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

/// <summary>
/// HTTP integration tests for EmployeesController (GET, POST, PUT, DELETE).
/// Uses a fresh tenant + user per test so each is independent.
/// </summary>
public class EmployeeControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);

    public EmployeeControllerTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private static StringContent Json(object obj) =>
        new(JsonSerializer.Serialize(obj), Encoding.UTF8, "application/json");

    /// <summary>Seeds a tenant + user and returns (tenantId, userId).</summary>
    private (Guid tenantId, Guid userId) SeedUser(string email, string password, string role = "hr_officer")
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrmsDbContext>();
        if (db.Users.Any(u => u.Email == email))
        {
            var existing = db.Users.First(u => u.Email == email);
            return (existing.TenantId, existing.Id);
        }
        var tenantId = Guid.NewGuid();
        db.Tenants.Add(new Tenant { Id = tenantId, Name = "Tenant " + tenantId, Subdomain = "t-" + tenantId, IsActive = true });
        var userId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = userId, TenantId = tenantId, Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = role, IsActive = true,
        });
        db.SaveChanges();
        return (tenantId, userId);
    }

    /// <summary>Logs in and returns a Bearer token.</summary>
    private async Task<string> LoginAsync(string email, string password)
    {
        using var client = _factory.CreateClient();
        var resp = await client.PostAsync("/api/auth/login", Json(new { email, password }));
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        return body.GetProperty("token").GetString()!;
    }

    /// <summary>Creates an HttpClient pre-authorised with the given JWT.</summary>
    private HttpClient AuthClient(string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>Inserts an Employee row directly via DbContext and returns its Id.</summary>
    private Guid SeedEmployee(Guid tenantId, string firstName = "Jane", string lastName = "Doe")
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrmsDbContext>();
        var id = Guid.NewGuid();
        db.Employees.Add(new Employee
        {
            Id = id, TenantId = tenantId,
            FirstName = firstName, LastName = lastName,
            Email = (id.ToString("N")[..8]) + "@seed.com",
            EmployeeNumber = "EMP-" + id.ToString("N")[..6],
            EmploymentType = "full_time", Status = "active",
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow),
        });
        db.SaveChanges();
        return id;
    }

    // ── GET /api/employees ─────────────────────────────────────────────────

    [Fact]
    public async Task GetAll_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/employees");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task GetAll_WithValidToken_Returns200AndArray()
    {
        var email = $"list-{Guid.NewGuid():N}@test.com";
        var (tenantId, _) = SeedUser(email, "Password1!");
        SeedEmployee(tenantId);

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.GetAsync("/api/employees");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
    }

    [Fact]
    public async Task GetAll_TenantIsolation_OnlyReturnsTenantEmployees()
    {
        var emailA = $"iso-a-{Guid.NewGuid():N}@test.com";
        var emailB = $"iso-b-{Guid.NewGuid():N}@test.com";
        var (tenantIdA, _) = SeedUser(emailA, "Password1!");
        SeedEmployee(tenantIdA, "TenantAEmployee", "Only");
        SeedUser(emailB, "Password1!");  // fresh tenant, zero employees

        var tokenB = await LoginAsync(emailB, "Password1!");
        using var client = AuthClient(tokenB);
        var resp = await client.GetAsync("/api/employees");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
        Assert.Equal(0, body.GetArrayLength());
    }

    // ── GET /api/employees/{id} ────────────────────────────────────────────

    [Fact]
    public async Task GetById_ExistingEmployee_Returns200()
    {
        var email = $"byid-{Guid.NewGuid():N}@test.com";
        var (tenantId, _) = SeedUser(email, "Password1!");
        var empId = SeedEmployee(tenantId, "Alice", "Smith");

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.GetAsync($"/api/employees/{empId}");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.Equal(empId.ToString(), body.GetProperty("id").GetString());
    }

    [Fact]
    public async Task GetById_NonExistentId_Returns404()
    {
        var email = $"404-{Guid.NewGuid():N}@test.com";
        SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.GetAsync($"/api/employees/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task GetById_OtherTenantEmployee_Returns404()
    {
        var emailA = $"xten-a-{Guid.NewGuid():N}@test.com";
        var emailB = $"xten-b-{Guid.NewGuid():N}@test.com";
        var (tenantIdA, _) = SeedUser(emailA, "Password1!");
        var empIdA = SeedEmployee(tenantIdA, "ShouldBeHidden", "FromB");
        SeedUser(emailB, "Password1!");

        var tokenB = await LoginAsync(emailB, "Password1!");
        using var client = AuthClient(tokenB);
        var resp = await client.GetAsync($"/api/employees/{empIdA}");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    // ── POST /api/employees ────────────────────────────────────────────────

    [Fact]
    public async Task Create_ValidEmployee_Returns201WithId()
    {
        var email = $"create-{Guid.NewGuid():N}@test.com";
        SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var payload = new
        {
            firstName = "Bob",
            lastName = "Builder",
            email = $"bob-{Guid.NewGuid():N}@example.com",
            employmentType = "full_time",
            status = "active",
            startDate = "2024-01-15",
        };
        var resp = await client.PostAsync("/api/employees", Json(payload));

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.True(body.TryGetProperty("id", out var idProp));
        Assert.Equal(JsonValueKind.String, idProp.ValueKind);
    }

    [Fact]
    public async Task Create_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();
        var resp = await client.PostAsync("/api/employees",
            Json(new { firstName = "X", lastName = "Y", email = "x@y.com" }));
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    // ── PUT /api/employees/{id} ────────────────────────────────────────────

    [Fact]
    public async Task Update_ExistingEmployee_Returns200WithChanges()
    {
        var email = $"upd-{Guid.NewGuid():N}@test.com";
        var (tenantId, _) = SeedUser(email, "Password1!");
        var empId = SeedEmployee(tenantId, "OldFirst", "OldLast");

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var resp = await client.PutAsync($"/api/employees/{empId}",
            Json(new { firstName = "NewFirst", lastName = "NewLast" }));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.Equal("NewFirst", body.GetProperty("firstName").GetString());
        Assert.Equal("NewLast", body.GetProperty("lastName").GetString());
    }

    [Fact]
    public async Task Update_NonExistentEmployee_Returns404()
    {
        var email = $"upd404-{Guid.NewGuid():N}@test.com";
        SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.PutAsync($"/api/employees/{Guid.NewGuid()}",
            Json(new { firstName = "Ghost" }));
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    // ── DELETE /api/employees/{id} ─────────────────────────────────────────

    [Fact]
    public async Task Delete_ExistingEmployee_Returns204AndSetsStatusTerminated()
    {
        var email = $"del-{Guid.NewGuid():N}@test.com";
        var (tenantId, _) = SeedUser(email, "Password1!");
        var empId = SeedEmployee(tenantId, "ToDelete", "Employee");

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var delResp = await client.DeleteAsync($"/api/employees/{empId}");
        Assert.Equal(HttpStatusCode.NoContent, delResp.StatusCode);

        // Verify soft-delete: status should now be "terminated"
        var getResp = await client.GetAsync($"/api/employees/{empId}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);
        var body = await getResp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.Equal("terminated", body.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Delete_NonExistentEmployee_Returns404()
    {
        var email = $"delnf-{Guid.NewGuid():N}@test.com";
        SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.DeleteAsync($"/api/employees/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }
}
