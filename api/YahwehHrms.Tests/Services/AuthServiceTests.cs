using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using YahwehHrms.Core.Entities;
using YahwehHrms.Infrastructure.Data;
using YahwehHrms.Infrastructure.Services;

namespace YahwehHrms.Tests.Services;

public class AuthServiceTests
{
    private static HrmsDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<HrmsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new HrmsDbContext(opts);
    }

    private static (AuthService svc, Mock<IJwtService> jwtMock, HrmsDbContext db) Build()
    {
        var db      = CreateDb();
        var jwtMock = new Mock<IJwtService>(MockBehavior.Strict);
        var svc     = new AuthService(db, jwtMock.Object);
        return (svc, jwtMock, db);
    }

    private static User SeedUser(HrmsDbContext db,
        string email    = "user@acme.com",
        string password = "Test@12345",
        bool isActive   = true)
    {
        var user = new User
        {
            Id           = Guid.NewGuid(),
            TenantId     = Guid.NewGuid(),
            Email        = email.Trim().ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role         = "employee",
            IsActive     = isActive,
        };
        db.Users.Add(user);
        db.SaveChanges();
        return user;
    }

    [Fact]
    public async Task AuthenticateAsync_ReturnsToken_WhenCredentialsAreValid()
    {
        var (svc, jwtMock, db) = Build();
        var user               = SeedUser(db);

        jwtMock.Setup(j => j.GenerateTenantUserToken(It.Is<User>(u => u.Id == user.Id)))
               .Returns("test-jwt-token");

        var token = await svc.AuthenticateAsync(user.Email, "Test@12345");

        Assert.Equal("test-jwt-token", token);
    }

    [Fact]
    public async Task AuthenticateAsync_UpdatesLastLogin_OnSuccess()
    {
        var (svc, jwtMock, db) = Build();
        var user               = SeedUser(db);
        var before             = DateTime.UtcNow.AddSeconds(-1);

        jwtMock.Setup(j => j.GenerateTenantUserToken(It.IsAny<User>())).Returns("tok");

        await svc.AuthenticateAsync(user.Email, "Test@12345");

        var updated = await db.Users.FindAsync(user.Id);
        Assert.NotNull(updated!.LastLogin);
        Assert.True(updated.LastLogin >= before);
    }

    [Fact]
    public async Task AuthenticateAsync_TrimsAndLowercasesEmail()
    {
        var (svc, jwtMock, db) = Build();
        SeedUser(db, email: "mixed@CASE.com");

        jwtMock.Setup(j => j.GenerateTenantUserToken(It.IsAny<User>())).Returns("tok");

        var token = await svc.AuthenticateAsync("  Mixed@case.com  ", "Test@12345");

        Assert.Equal("tok", token);
    }

    [Fact]
    public async Task AuthenticateAsync_ReturnsNull_WhenPasswordIsWrong()
    {
        var (svc, _, db) = Build();
        var user         = SeedUser(db);

        var token = await svc.AuthenticateAsync(user.Email, "WrongPassword!");

        Assert.Null(token);
    }

    [Fact]
    public async Task AuthenticateAsync_ReturnsNull_WhenEmailNotFound()
    {
        var (svc, _, db) = Build();
        SeedUser(db, email: "exists@acme.com");

        var token = await svc.AuthenticateAsync("nobody@acme.com", "Test@12345");

        Assert.Null(token);
    }

    [Fact]
    public async Task AuthenticateAsync_ReturnsNull_WhenUserIsInactive()
    {
        var (svc, _, db) = Build();
        var user         = SeedUser(db, isActive: false);

        var token = await svc.AuthenticateAsync(user.Email, "Test@12345");

        Assert.Null(token);
    }

    [Fact]
    public async Task AuthenticateAsync_DoesNotUpdateLastLogin_OnFailure()
    {
        var (svc, _, db) = Build();
        var user         = SeedUser(db);

        await svc.AuthenticateAsync(user.Email, "BadPassword");

        var unchanged = await db.Users.FindAsync(user.Id);
        Assert.Null(unchanged!.LastLogin);
    }

    [Fact]
    public async Task AuthenticateAsync_DoesNotCallJwtService_WhenAuthFails()
    {
        var (svc, jwtMock, db) = Build();
        SeedUser(db, email: "u@a.com");

        // MockBehavior.Strict — any unexpected call throws
        await svc.AuthenticateAsync("u@a.com", "wrong");

        jwtMock.Verify(j => j.GenerateTenantUserToken(It.IsAny<User>()), Times.Never);
    }
}
