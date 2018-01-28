import { EventEmitter } from "events";
import * as path from "path";
import * as express from "express";
import * as createSocketIOServer from "socket.io";
import Screen from "./Screen";
import Mouse from "./Mouse";
import Keyboard from "./Keyboard";
import { Server } from "net";

export default class RemoteJSServer extends EventEmitter {
  webroot: string;
  io: SocketIO.Namespace;
  socket: Server;
  app: express.Application;
  started: boolean = false;
  screen: Screen;
  mouse: Mouse;
  keyboard: Keyboard;
  port: number;
  refreshInterval: number;

  constructor(options?) {
    super();

    options = options || {};

    this.screen = options.screen || new Screen();
    this.mouse = options.mouse || new Mouse(this.screen);
    this.keyboard = options.keyboard || new Keyboard();
    this.port = options.port || 4444;
    this.webroot = options.webroot || "../client";
    this.refreshInterval = options.refreshInterval || 10 * 1000;
  }

  listen(port, callback?) {
    if (this.started) return;

    if (typeof port === "function") {
      callback = port;
      port = null;
    }

    port = this.port = port || this.port;
    callback = callback || function () { };

    this.app = express();
    this.app.disable("x-powered-by");
    this.app.use(express.static(path.join(__dirname, this.webroot)));

    this.socket = this.app.listen(port, () => {
      this.startRefreshInterval();
      this.started = true;
      this.emit("start");
      callback();
    });

    this.io = createSocketIOServer(this.socket, {
      path: "/sockets"
    }).on("connection", (socket) => {
      socket
        .on("mouseMove", (movementX, movementY) => this.mouse.move(movementX, movementY))
        .on("mouseDown", (key) => this.mouse.down(key))
        .on("mouseUp", (key) => this.mouse.up(key))
        .on("mouseScroll", (amount, direction) => this.mouse.scroll(amount, direction))
        .on("keyboardDown", (key) => this.keyboard.down(key))
        .on("keyboardUp", (key) => this.keyboard.up(key));

      this.emit("clientConnect", socket);
    });

    return this.socket;
  }

  startRefreshInterval() {
    setInterval(() => {
      this.screen.refreshSize();
      this.emit("refresh");
    }, this.refreshInterval);
  }
}
