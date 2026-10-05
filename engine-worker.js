// One real, single-threaded .NET runtime. No special isolation headers required.
let bridge;
async function boot() {
  const started = performance.now();
  const { dotnet } = await import(new URL('./_framework/dotnet.js', import.meta.url).href);
  const runtime = await dotnet.withDiagnosticTracing(false).create();
  const exports = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName);
  bridge = exports.VineBridge;
  postMessage({ type: 'ready', milliseconds: performance.now() - started });
}
const ready = boot().catch(error => postMessage({ type: 'boot-error', message: String(error) }));
self.addEventListener('message', async event => {
  const { id, request } = event.data;
  await ready;
  if (!bridge) return;
  try {
    const start = performance.now();
    const response = JSON.parse(bridge.Run(JSON.stringify(request)));
    postMessage({ type: 'result', id, response, milliseconds: performance.now() - start });
  } catch (error) {
    postMessage({ type: 'result', id, response: { status: 'error', message: String(error) } });
  }
});
