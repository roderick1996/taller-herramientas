const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');

let handler = null;
let loading = null;

// Evita que el servidor abra un puerto: solo captura el handler de Express
http.Server.prototype.listen = function () {
  handler = this.listeners('request')[0];
  return this;
};

async function init() {
  const entry = path.join(__dirname, '..', 'server', 'src/index.js');
  await import(pathToFileURL(entry).href);
  for (let i = 0; i < 100 && !handler; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!handler) throw new Error('El servidor no registro ningun handler');
}

module.exports = async (req, res) => {
  try {
    if (!handler) await (loading = loading || init());
    return handler(req, res);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Error iniciando el servidor: ' + e.message }));
  }
};
