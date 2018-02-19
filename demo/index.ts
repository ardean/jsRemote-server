import { Server } from "../src";
import { log } from "util";

(async () => {
  const server = new Server();
  server.on("clientConnect", socket => {
    let address = socket.request.connection.remoteAddress.replace(/^.*:/, "");
    if (address.toString() === "1") address = "127.0.0.1";

    log("new client connected: " + address);
    socket.once("disconnect", () => log("client disconnected: " + address));
  });

  await server.start();

  log(`jsRemote is running on port ${server.port}`);
})();