let appPromise;

module.exports = async (req, res) => {
  try {
    appPromise = appPromise || import('../server/src/index.js');
    const mod = await appPromise;
    return mod.default(req, res);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Error iniciando el servidor: ' + e.message }));
  }
};
