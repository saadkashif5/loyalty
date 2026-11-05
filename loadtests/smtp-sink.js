// A mail server that accepts everything and keeps nothing, so load tests can
// run the API in production mode (which must send real email) without a
// provider. Speaks just enough SMTP for nodemailer.
//   node loadtests/smtp-sink.js [port]
const net = require("net");

const port = Number(process.argv[2] || 2525);
let received = 0;

net
  .createServer((socket) => {
    let inData = false;
    let buffer = "";
    socket.write("220 sink ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("latin1");
      let end;
      while ((end = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            received += 1;
            socket.write("250 OK queued\r\n");
          }
          continue;
        }
        const verb = line.slice(0, 4).toUpperCase();
        if (verb === "EHLO") socket.write("250-sink\r\n250 OK\r\n");
        else if (verb === "HELO") socket.write("250 sink\r\n");
        else if (verb === "DATA") {
          inData = true;
          socket.write("354 End with .\r\n");
        } else if (verb === "QUIT") {
          socket.end("221 Bye\r\n");
        } else socket.write("250 OK\r\n");
      }
    });
    socket.on("error", () => undefined);
  })
  .listen(port, () => console.log(`SMTP sink on ${port}`));

process.on("SIGTERM", () => {
  console.log(`SMTP sink received ${received} messages`);
  process.exit(0);
});
