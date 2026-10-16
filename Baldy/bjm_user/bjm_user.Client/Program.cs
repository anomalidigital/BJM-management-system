using bjm_user.Client.Data;
using bjm_user.Client.Layanan;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);

#if MANDIRI
// Demo GitHub Pages (tanpa server): komponen akar dipasang di index.html statis. Versi user dirender server lewat App.razor.
builder.RootComponents.Add<bjm_user.Client.Routes>("#app");
builder.RootComponents.Add<Microsoft.AspNetCore.Components.Web.HeadOutlet>("head::after");
#endif

builder.Services.AddScoped(_ => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
builder.Services.AddScoped<Penyimpanan>();
builder.Services.AddScoped<Sesi>();
builder.Services.AddScoped<Toast>();
builder.Services.AddScoped<Db>();
builder.Services.AddScoped<Lampiran>();

var host = builder.Build();

// Sesi & data dimuat sebelum halaman pertama dirender, supaya tidak ada kedipan "belum login".
await host.Services.GetRequiredService<Sesi>().MuatAsync();
await host.Services.GetRequiredService<Db>().MuatAsync();

await host.RunAsync();
