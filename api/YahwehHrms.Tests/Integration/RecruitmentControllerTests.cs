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

public class RecruitmentControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);

    public RecruitmentControllerTests(CustomWebApplicationFactory factory) => _factory = factory;

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

    private Guid SeedRequisition(Guid tenantId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrmsDbContext>();
        var id = Guid.NewGuid();
        db.JobRequisitions.Add(new JobRequisition { Id = id, TenantId = tenantId, Title = "Dev", Status = "open", Type = "full-time", Headcount = 1, CreatedAt = DateTimeOffset.UtcNow });
        db.SaveChanges();
        return id;
    }

    [Fact]
    public async Task GetAll_WithoutToken_Returns401()
    {
        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/job-requisitions");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task GetAll_WithValidToken_Returns200AndArray()
    {
        var email = $"req-{Guid.NewGuid():N}@test.com";
        var (tenantId, _) = SeedUser(email, "Password1!");
        SeedRequisition(tenantId);

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.GetAsync("/api/job-requisitions");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
    }

    [Fact]
    public async Task GetById_ExistingRequisition_Returns200()
    {
        var email = $"req-id-{Guid.NewGuid():N}@test.com";
        var (tenantId, _) = SeedUser(email, "Password1!");
        var reqId = SeedRequisition(tenantId);

        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);
        var resp = await client.GetAsync($"/api/job-requisitions/{reqId}");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.Equal(reqId.ToString(), body.GetProperty("id").GetString());
    }

    [Fact]
    public async Task GetById_NonExistent_Returns404()
    {
        var email = $"req-404-{Guid.NewGuid():N}@test.com";
        SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var resp = await client.GetAsync($"/api/job-requisitions/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Create_ValidRequisition_Returns201()
    {
        var email = $"req-create-{Guid.NewGuid():N}@test.com";
        SeedUser(email, "Password1!");
        var token = await LoginAsync(email, "Password1!");
        using var client = AuthClient(token);

        var payload = new { title = "Senior Engineer", status = "open", type = "full-time", headcount = 2 };
        var resp = await client.PostAsync("/api/job-requisitions", Json(payload));

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);
        Assert.True(body.TryGetProperty("id", out _));
    }
}
