let appPromise;

function resolveApp(mod) {
  let m = mod;
  for (let i = 0; i < 4 && m && typeof m !== 'function'; i++) m = m.default;
  return m;
}

module.exports = async (req, res) => {
  try {
    appPromise = appPromise || import('../server/src/index.js');
    const mod = await appPromise;
    const app = resolveApp(mod);
    if (typeof app !== 'function') {
      throw new Error('sin app exportada; claves: ' + Object.keys(mod).join(','));
    }
    return app(req, res);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Error iniciando el servidor: ' + e.message }));
  }
};
