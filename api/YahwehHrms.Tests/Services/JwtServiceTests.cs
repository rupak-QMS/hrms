using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Xunit;
using YahwehHrms.Core.Entities;
using YahwehHrms.Infrastructure.Services;

namespace YahwehHrms.Tests.Services;

public class JwtServiceTests
{
    private static JwtService BuildService(int expiresInHours = 8)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"]         = "super-secret-test-key-that-is-long-enough-for-hmac",
                ["Jwt:ExpiresInHours"] = expiresInHours.ToString(),
            })
            .Build();
        return new JwtService(config);
    }

    private static JwtSecurityToken Decode(string token)
        => new JwtSecurityTokenHandler().ReadJwtToken(token);

    [Fact]
    public void GenerateTenantUserToken_ReturnsNonEmptyString()
    {
        var svc  = BuildService();
        var user = new User { Id = Guid.NewGuid(), Email = "hr@test.com", Role = "hr_officer", TenantId = Guid.NewGuid() };
        var token = svc.GenerateTenantUserToken(user);
        Assert.False(string.IsNullOrWhiteSpace(token));
    }

    [Fact]
    public void GenerateTenantUserToken_ContainsCorrectClaims()
    {
        var svc      = BuildService();
        var tenantId = Guid.NewGuid();
        var userId   = Guid.NewGuid();
        var user     = new User { Id = userId, Email = "emp@acme.com", Role = "employee", TenantId = tenantId };

        var jwt = Decode(svc.GenerateTenantUserToken(user));

        Assert.Equal(userId.ToString(),   jwt.Subject);
        Assert.Equal("emp@acme.com",      jwt.Claims.First(c => c.Type == JwtRegisteredClaimNames.Email).Value);
        Assert.Equal("employee",          jwt.Claims.First(c => c.Type == ClaimTypes.Role).Value);
        Assert.Equal(tenantId.ToString(), jwt.Claims.First(c => c.Type == "tenant_id").Value);
        Assert.Equal("user",              jwt.Claims.First(c => c.Type == "type").Value);
    }

    [Fact]
    public void GenerateTenantUserToken_ExpiresAfterConfiguredHours()
    {
        var svc  = BuildService(expiresInHours: 4);
        var user = new User { Id = Guid.NewGuid(), Email = "x@y.com", Role = "employee", TenantId = Guid.NewGuid() };

        var before   = DateTime.UtcNow;
        var jwt      = Decode(svc.GenerateTenantUserToken(user));

        // ValidFrom is MinValue when notBefore is not set; compare ValidTo to pre-call timestamp
        Assert.InRange((jwt.ValidTo - before).TotalHours, 3.99, 4.01);
    }

    [Fact]
    public void GenerateSuperAdminToken_HasSuperAdminRole()
    {
        var svc   = BuildService();
        var admin = new SuperAdminUser { Id = Guid.NewGuid(), Email = "sa@yahweh.com" };

        var jwt = Decode(svc.GenerateSuperAdminToken(admin));

        Assert.Equal("SuperAdmin", jwt.Claims.First(c => c.Type == ClaimTypes.Role).Value);
        Assert.Equal("superadmin", jwt.Claims.First(c => c.Type == "type").Value);
    }

    [Fact]
    public void GenerateSuperAdminToken_DoesNotContainTenantIdClaim()
    {
        var svc   = BuildService();
        var admin = new SuperAdminUser { Id = Guid.NewGuid(), Email = "sa@yahweh.com" };

        var jwt = Decode(svc.GenerateSuperAdminToken(admin));

        Assert.DoesNotContain(jwt.Claims, c => c.Type == "tenant_id");
    }

    [Fact]
    public void GenerateTenantUserToken_ThrowsWhenSecretMissing()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();
        var svc  = new JwtService(config);
        var user = new User { Id = Guid.NewGuid(), Email = "a@b.com", Role = "employee", TenantId = Guid.NewGuid() };

        Assert.Throws<InvalidOperationException>(() => svc.GenerateTenantUserToken(user));
    }

    [Fact]
    public void GenerateTenantUserToken_DefaultsToEightHoursWhenExpiryNotConfigured()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "super-secret-test-key-that-is-long-enough-for-hmac",
            })
            .Build();
        var svc  = new JwtService(config);
        var user = new User { Id = Guid.NewGuid(), Email = "a@b.com", Role = "employee", TenantId = Guid.NewGuid() };

        var before = DateTime.UtcNow;
        var jwt    = Decode(svc.GenerateTenantUserToken(user));

        Assert.InRange((jwt.ValidTo - before).TotalHours, 7.99, 8.01);
    }
}
