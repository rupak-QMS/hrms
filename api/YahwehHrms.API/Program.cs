using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Hangfire;
using Hangfire.PostgreSql;
using Serilog;
using System.Net.Sockets;
using System.Text;
using YahwehHrms.Infrastructure;
using YahwehHrms.Infrastructure.Data;
using YahwehHrms.Infrastructure.Hubs;
using YahwehHrms.Infrastructure.Services;
using YahwehHrms.Infrastructure.Middleware;
// Railway healthcheck uses /health/live (liveness probe — always returns 200)
var builder = WebApplication.CreateBuilder(args);

// ── Force IPv4: Railway does not support IPv6 ─────────────────────────────────
// Npgsql has no "Prefer IP Version" connection-string keyword.
// Instead, resolve the DB hostname to an IPv4 address via DNS before any
// service is registered, so EF Core, Hangfire, and health-checks all use it.
{
    var rawConn = builder.Configuration.GetConnectionString("DefaultConnection");
    if (rawConn != null)
    {
        try
        {
            var hostMatch = System.Text.RegularExpressions.Regex.Match(
                rawConn,
                @"(?:^|;)\s*(?:Host|Server)\s*=\s*([^;]+)",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (hostMatch.Success)
            {
                var hostname = hostMatch.Groups[1].Value.Trim();
                if (!System.Net.IPAddress.TryParse(hostname, out _))
                {
                    var addrs = await System.Net.Dns.GetHostAddressesAsync(hostname);
                    var ipv4 = addrs.FirstOrDefault(
                        a => a.AddressFamily == AddressFamily.InterNetwork);
                    if (ipv4 is not null)
                    {
                        var newConn = rawConn.Replace(
                            hostname, ipv4.ToString(),
                            StringComparison.OrdinalIgnoreCase);
                        builder.Configuration["ConnectionStrings:DefaultConnection"] = newConn;
                        Console.WriteLine("[IPv4] Resolved " + hostname + " -> " + ipv4);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("[IPv4] DNS resolution failed: " + ex.Message);
        }
    }
}

// ── Serilog ──────────────────────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.Seq(builder.Configuration["Seq:ServerUrl"] ?? "http://localhost:5341")
    .CreateLogger();

builder.Host.UseSerilog();

// ── Services ─────────────────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Yahweh HRMS API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
    });
});

var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("JWT secret not configured");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero,
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) &&
                    ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                {
                    ctx.Token = token;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddSignalR();

if (!builder.Environment.IsEnvironment("Testing"))
{
    builder.Services.AddHangfire(config =>
        config.UsePostgreSqlStorage(
            builder.Configuration.GetConnectionString("DefaultConnection")));
    builder.Services.AddHangfireServer();
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy
            .WithOrigins(
                "http://localhost:3000",
                "https://hrms.vercel.app",
                builder.Configuration["App:FrontendUrl"] ?? "")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

// ── Seed default super admin ──────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    try
    {
        var superAdminAuth = scope.ServiceProvider.GetRequiredService<ISuperAdminAuthService>();
        await superAdminAuth.SeedDefaultAdminIfNoneExistsAsync();
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetService<ILogger<Program>>();
        logger?.LogWarning(ex, "Startup seeding failed - app will continue without seeding.");
    }
}

// ── Middleware pipeline ───────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (app.Environment.IsDevelopment())
        app.UseHttpsRedirection();
app.UseCors("Frontend");
app.UseSerilogRequestLogging();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<ModuleGuardMiddleware>();

if (app.Environment.IsDevelopment())
{
    if (!app.Environment.IsEnvironment("Testing"))
    {
        app.UseHangfireDashboard("/hangfire");
    }
}

// /health/live — liveness probe; always returns 200 (no DB dependency).
app.MapHealthChecks("/health/live", new HealthCheckOptions
                    {
                        Predicate = _ => false,
                            ResultStatusCodes =
                                {
                                        [HealthStatus.Healthy]   = StatusCodes.Status200OK,
                                                [HealthStatus.Degraded]  = StatusCodes.Status200OK,
                                                        [HealthStatus.Unhealthy] = StatusCodes.Status200OK,
                                                            }
                                                            });
                                                            
// /health/ready — readiness probe; checks DB (and Redis if configured).
app.MapHealthChecks("/health/ready");

// Root endpoint — Railway default healthcheck probe hits GET /.
app.MapGet("/", () => Results.Ok(new { status = "ok" }));

app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHealthChecks("/health");

app.Run();

public partial class Program { }
