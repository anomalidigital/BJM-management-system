using bjm_user.Client.Data;
using bjm_user.Client.Layanan;
using bjm_user.Components;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorComponents()
    .AddInteractiveWebAssemblyComponents();

// Layanan aplikasi juga terdaftar di server supaya halaman yang dirender statis (galat, tidak ditemukan)
// tetap bisa memakai layout Client. Datanya sendiri hanya dimuat di browser (WebAssembly).
builder.Services.AddScoped(_ => new HttpClient { BaseAddress = new Uri("http://localhost/") });
builder.Services.AddScoped<Penyimpanan>();
builder.Services.AddScoped<Sesi>();
builder.Services.AddScoped<Toast>();
builder.Services.AddScoped<Db>();
builder.Services.AddScoped<Lampiran>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseWebAssemblyDebugging();
}
else
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    app.UseHsts();
}
app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.UseHttpsRedirection();

app.UseAntiforgery();

app.MapStaticAssets();
app.MapRazorComponents<App>()
    .AddInteractiveWebAssemblyRenderMode()
    .AddAdditionalAssemblies(typeof(bjm_user.Client._Imports).Assembly);

app.Run();
