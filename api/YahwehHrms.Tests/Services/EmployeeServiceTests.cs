using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using YahwehHrms.Core.Entities;
using YahwehHrms.Infrastructure.Data;
using YahwehHrms.Infrastructure.Services;

namespace YahwehHrms.Tests.Services;

public class EmployeeServiceTests
{
    private static HrmsDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<HrmsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new HrmsDbContext(opts);
    }

    private static EmployeeService Svc(HrmsDbContext db)
        => new(db, NullLogger<EmployeeService>.Instance);

    // ── GetAllAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAllAsync_ReturnsOnlyEmployeesForTenant()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenantA        = Guid.NewGuid();
        var tenantB        = Guid.NewGuid();

        db.Employees.AddRange(
            new Employee { Id = Guid.NewGuid(), TenantId = tenantA, FirstName = "Alice", Email = "a@a.com" },
            new Employee { Id = Guid.NewGuid(), TenantId = tenantA, FirstName = "Bob",   Email = "b@a.com" },
            new Employee { Id = Guid.NewGuid(), TenantId = tenantB, FirstName = "Carol", Email = "c@b.com" });
        await db.SaveChangesAsync();

        var result = (await svc.GetAllAsync(tenantA)).ToList();

        Assert.Equal(2, result.Count);
        Assert.All(result, e => Assert.Equal(tenantA, e.TenantId));
    }

    [Fact]
    public async Task GetAllAsync_FiltersOnStatus()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenant         = Guid.NewGuid();

        db.Employees.AddRange(
            new Employee { Id = Guid.NewGuid(), TenantId = tenant, FirstName = "Active1", Email = "a1@t.com", Status = "active" },
            new Employee { Id = Guid.NewGuid(), TenantId = tenant, FirstName = "Active2", Email = "a2@t.com", Status = "active" },
            new Employee { Id = Guid.NewGuid(), TenantId = tenant, FirstName = "Term",    Email = "t@t.com",  Status = "terminated" });
        await db.SaveChangesAsync();

        var result = await svc.GetAllAsync(tenant, status: "active");

        Assert.Equal(2, result.Count());
        Assert.All(result, e => Assert.Equal("active", e.Status));
    }

    [Fact]
    public async Task GetAllAsync_FiltersOnDepartment()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenant         = Guid.NewGuid();
        var deptId         = Guid.NewGuid();

        db.Employees.AddRange(
            new Employee { Id = Guid.NewGuid(), TenantId = tenant, DepartmentId = deptId,         FirstName = "X", Email = "x@t.com" },
            new Employee { Id = Guid.NewGuid(), TenantId = tenant, DepartmentId = Guid.NewGuid(), FirstName = "Y", Email = "y@t.com" });
        await db.SaveChangesAsync();

        var result = await svc.GetAllAsync(tenant, departmentId: deptId);

        Assert.Single(result);
        Assert.Equal(deptId, result.First().DepartmentId);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsOrderedByFirstNameThenLastName()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenant         = Guid.NewGuid();

        db.Employees.AddRange(
            new Employee { TenantId = tenant, FirstName = "Zara",  LastName = "X", Email = "z@t.com" },
            new Employee { TenantId = tenant, FirstName = "Alice", LastName = "B", Email = "a@t.com" },
            new Employee { TenantId = tenant, FirstName = "Alice", LastName = "A", Email = "aa@t.com" });
        await db.SaveChangesAsync();

        var result = (await svc.GetAllAsync(tenant)).ToList();

        Assert.Equal("Alice", result[0].FirstName); Assert.Equal("A", result[0].LastName);
        Assert.Equal("Alice", result[1].FirstName); Assert.Equal("B", result[1].LastName);
        Assert.Equal("Zara",  result[2].FirstName);
    }

    // ── GetByIdAsync ─────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByIdAsync_ReturnsEmployee_WhenExists()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenant         = Guid.NewGuid();
        var empId          = Guid.NewGuid();

        db.Employees.Add(new Employee { Id = empId, TenantId = tenant, FirstName = "Dave", Email = "d@t.com" });
        await db.SaveChangesAsync();

        var result = await svc.GetByIdAsync(tenant, empId);

        Assert.NotNull(result);
        Assert.Equal(empId, result!.Id);
        Assert.Equal("Dave", result.FirstName);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenNotFound()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);

        var result = await svc.GetByIdAsync(Guid.NewGuid(), Guid.NewGuid());

        Assert.Null(result);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenWrongTenant()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenant         = Guid.NewGuid();
        var empId          = Guid.NewGuid();

        db.Employees.Add(new Employee { Id = empId, TenantId = tenant, FirstName = "Eve", Email = "e@t.com" });
        await db.SaveChangesAsync();

        var result = await svc.GetByIdAsync(Guid.NewGuid(), empId);

        Assert.Null(result);
    }

    // ── CreateAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_PersistsEmployee()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenant         = Guid.NewGuid();

        var created = await svc.CreateAsync(tenant, new Employee
        {
            FirstName = "Frank",
            LastName  = "Doe",
            Email     = "frank@t.com",
            Status    = "active",
        });

        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(tenant, created.TenantId);
        Assert.Equal("Frank", created.FirstName);
        Assert.True(created.CreatedAt > DateTimeOffset.UtcNow.AddSeconds(-5));
    }

    [Fact]
    public async Task CreateAsync_CanBeFoundAfterCreation()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenant         = Guid.NewGuid();

        var created = await svc.CreateAsync(tenant, new Employee { FirstName = "Hannah", Email = "h@t.com" });
        var fetched = await svc.GetByIdAsync(tenant, created.Id);

        Assert.NotNull(fetched);
        Assert.Equal("Hannah", fetched!.FirstName);
    }

    // ── UpdateAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_PersistsChanges()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenant         = Guid.NewGuid();

        var emp = await svc.CreateAsync(tenant, new Employee { FirstName = "Ian", Email = "ian@t.com", Status = "active" });

        emp.FirstName = "Ivan";
        emp.Status    = "inactive";
        var updated = await svc.UpdateAsync(tenant, emp);

        Assert.Equal("Ivan",     updated.FirstName);
        Assert.Equal("inactive", updated.Status);
    }

    [Fact]
    public async Task UpdateAsync_ThrowsKeyNotFound_WhenEmployeeDoesNotExist()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.UpdateAsync(Guid.NewGuid(), new Employee { Id = Guid.NewGuid(), Email = "x@t.com" }));
    }

    [Fact]
    public async Task UpdateAsync_ThrowsKeyNotFound_WhenWrongTenant()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenant         = Guid.NewGuid();

        var emp = await svc.CreateAsync(tenant, new Employee { FirstName = "Jo", Email = "jo@t.com" });

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.UpdateAsync(Guid.NewGuid(), emp));
    }

    // ── TerminateAsync ───────────────────────────────────────────────────────

    [Fact]
    public async Task TerminateAsync_SetsStatusToTerminated()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenant         = Guid.NewGuid();

        var emp = await svc.CreateAsync(tenant, new Employee { FirstName = "Kim", Email = "kim@t.com", Status = "active" });

        await svc.TerminateAsync(tenant, emp.Id, DateOnly.FromDateTime(DateTime.Today), "Redundancy");

        var fetched = await db.Employees.FindAsync(emp.Id);
        Assert.Equal("terminated", fetched!.Status);
        Assert.Equal(DateOnly.FromDateTime(DateTime.Today), fetched.EndDate);
    }

    [Fact]
    public async Task TerminateAsync_CreatesSeparationRecord()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenant         = Guid.NewGuid();

        var emp = await svc.CreateAsync(tenant, new Employee { FirstName = "Lee", Email = "lee@t.com" });

        await svc.TerminateAsync(tenant, emp.Id, DateOnly.FromDateTime(DateTime.Today), "Resigned");

        var sep = db.SeparationRecords.SingleOrDefault(s => s.EmployeeId == emp.Id);
        Assert.NotNull(sep);
        Assert.Equal("termination", sep!.Type);
        Assert.Equal("Resigned",    sep.Reason);
    }

    [Fact]
    public async Task TerminateAsync_ThrowsKeyNotFound_WhenNotExists()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.TerminateAsync(Guid.NewGuid(), Guid.NewGuid(), DateOnly.FromDateTime(DateTime.Today), "N/A"));
    }

    // ── GetDirectReportsAsync ────────────────────────────────────────────────

    [Fact]
    public async Task GetDirectReportsAsync_ReturnsOnlyDirectReports()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenant         = Guid.NewGuid();
        var managerId      = Guid.NewGuid();

        db.Employees.AddRange(
            new Employee { Id = Guid.NewGuid(), TenantId = tenant, ManagerId = managerId,         FirstName = "R1", Email = "r1@t.com" },
            new Employee { Id = Guid.NewGuid(), TenantId = tenant, ManagerId = managerId,         FirstName = "R2", Email = "r2@t.com" },
            new Employee { Id = Guid.NewGuid(), TenantId = tenant, ManagerId = Guid.NewGuid(),    FirstName = "NR", Email = "nr@t.com" });
        await db.SaveChangesAsync();

        var reports = (await svc.GetDirectReportsAsync(tenant, managerId)).ToList();

        Assert.Equal(2, reports.Count);
        Assert.All(reports, e => Assert.Equal(managerId, e.ManagerId));
    }

    // ── GetHeadcountAsync ────────────────────────────────────────────────────

    [Fact]
    public async Task GetHeadcountAsync_ExcludesTerminatedEmployees()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenant         = Guid.NewGuid();

        db.Employees.AddRange(
            new Employee { TenantId = tenant, Status = "active",     Email = "a@t.com" },
            new Employee { TenantId = tenant, Status = "active",     Email = "b@t.com" },
            new Employee { TenantId = tenant, Status = "terminated", Email = "c@t.com" });
        await db.SaveChangesAsync();

        var count = await svc.GetHeadcountAsync(tenant);

        Assert.Equal(2, count);
    }

    [Fact]
    public async Task GetHeadcountAsync_IsTenantScoped()
    {
        await using var db = CreateDb();
        var svc            = Svc(db);
        var tenantA        = Guid.NewGuid();
        var tenantB        = Guid.NewGuid();

        db.Employees.AddRange(
            new Employee { TenantId = tenantA, Status = "active", Email = "a1@t.com" },
            new Employee { TenantId = tenantA, Status = "active", Email = "a2@t.com" },
            new Employee { TenantId = tenantB, Status = "active", Email = "b1@t.com" });
        await db.SaveChangesAsync();

        Assert.Equal(2, await svc.GetHeadcountAsync(tenantA));
        Assert.Equal(1, await svc.GetHeadcountAsync(tenantB));
    }
}
