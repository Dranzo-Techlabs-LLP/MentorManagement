// Passenger (cPanel "Setup Node.js App") startup file for Next.js.
// cPanel/Passenger runs this file and provides the port via process.env.PORT.
const { createServer } = require("http");
const next = require("next");

const port = process.env.PORT || 3000;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`Elevate U portal ready on port ${port}`);
  });
});
