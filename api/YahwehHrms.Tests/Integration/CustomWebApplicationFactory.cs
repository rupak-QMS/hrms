using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.TestHost;
using YahwehHrms.Infrastructure.Data;

namespace YahwehHrms.Tests.Integration;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"]   = "Host=localhost;Database=test_db;Username=test;Password=test",
                ["Jwt:Secret"]                            = "REPLACE_WITH_64_CHARACTER_RANDOM_STRING_GENERATED_LOCALLY",
                ["Jwt:ExpiresInHours"]                   = "8",
                ["ConnectionStrings:Redis"]              = "",   // disable Redis
                ["Hangfire:UseDashboard"]                = "false",
                ["AllowedHosts"]                         = "*",
            });
        });

        builder.ConfigureTestServices(services =>
        {
            // Replace real HrmsDbContext (Npgsql) with InMemory
            // Remove ALL DbContext-related registrations (options, context, pool)
            var toRemove = services
                .Where(d => d.ServiceType == typeof(DbContextOptions<HrmsDbContext>)
                         || d.ServiceType == typeof(HrmsDbContext)
                         || (d.ServiceType.IsGenericType
                             && d.ServiceType.GetGenericTypeDefinition() == typeof(DbContextOptions<>)
                             && d.ServiceType.GetGenericArguments()[0] == typeof(HrmsDbContext)))
                .ToList();
            foreach (var d in toRemove) services.Remove(d);

            // Use a stable DB name so Seed and controller share the same store
            services.AddDbContext<HrmsDbContext>(opts =>
                opts.UseInMemoryDatabase("integration-tests"));

            // Remove Hangfire hosted services to prevent PostgreSQL connection attempts
            var hangfireServices = services
                .Where(s => s.ServiceType == typeof(IHostedService)
                         && s.ImplementationType?.FullName?.Contains("Hangfire") == true)
                .ToList();
            foreach (var s in hangfireServices) services.Remove(s);
        });
    }
}
