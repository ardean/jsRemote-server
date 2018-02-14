import * as os from "os";
import * as path from "path";
import * as express from "express";
import { EventEmitter } from "events";
import * as createSocketIOServer from "socket.io";
import Screen from "./Screen";
import Mouse from "./Mouse";
import Keyboard from "./Keyboard";
import { Server } from "net";
import stw, { Service } from "spread-the-word";

export default class JSRemoteServer extends EventEmitter {
  port: number;
  refreshInterval: number;
  service: Service;
  serviceName: string;
  broadcastService: boolean;
  refreshIntervalTimer: NodeJS.Timer = null;
  status: string = "Stopped";
  webroot: string;
  io: SocketIO.Namespace;
  app: express.Application;
  socket: Server;
  screen: Screen;
  mouse: Mouse;
  keyboard: Keyboard;

  constructor(options?) {
    super();

    options = options || {};

    this.screen = options.screen || new Screen();
    this.mouse = options.mouse || new Mouse(this.screen);
    this.keyboard = options.keyboard || new Keyboard();
    this.port = options.port || 4444;
    this.webroot = options.webroot;
    this.refreshInterval = options.refreshInterval || 10 * 1000;
    this.broadcastService = typeof options.broadcastService === "boolean" ? options.broadcastService : true;
    this.serviceName = options.serviceName || `${os.userInfo().username}'s Remote Receiver`;
  }

  get running() {
    return this.status !== "Stopped";
  }

  async start() {
    if (this.status !== "Stopped") return;
    this.setStatus("Starting");

    this.app = express();
    this.app.disable("x-powered-by");
    this.app.use(express.static(this.webroot || path.join(__dirname, "../client")));

    const startPromise = new Promise((resolve) => {
      this.socket = this.app.listen(this.port, async () => {
        this.startRefreshInterval();
        this.setStatus("Started");
        if (this.broadcastService) {
          this.service = await stw.spread({
            type: "jsremote",
            name: this.serviceName,
            port: this.port
          });
        }
        this.emit("start");
        resolve();
      });
    });

    this.io = createSocketIOServer(this.socket, {
      path: "/sockets"
    })
      .on("connection", socket => {
        socket
          .on("mouseMove", (movementX, movementY) => this.mouse.move(movementX, movementY))
          .on("mouseDown", key => this.mouse.down(key))
          .on("mouseUp", key => this.mouse.up(key))
          .on("mouseScroll", (amount, direction) => this.mouse.scroll(amount, direction))
          .on("keyboardDown", key => this.keyboard.down(key))
          .on("keyboardUp", key => this.keyboard.up(key));

        this.emit("clientConnect", socket);
      });

    return await startPromise;
  }

  async stop() {
    if (this.status !== "Started") return;

    this.setStatus("Stopping");
    await new Promise((resolve, reject) => {
      this.stopRefreshInterval();
      this.socket.close(() => {
        this.setStatus("Stopped");
        resolve();
      });
    });

    if (this.service) {
      this.service.destroy();
      this.service = null;
    }
  }

  async restart() {
    if (this.status !== "Started" && this.status !== "Stopped") return;
    if (this.status === "Started") await this.stop();
    await this.start();
  }

  startRefreshInterval() {
    this.refreshIntervalTimer = setInterval(() => {
      this.screen.refreshSize();
      this.emit("refresh");
    }, this.refreshInterval);
  }

  stopRefreshInterval() {
    clearInterval(this.refreshIntervalTimer);
    this.refreshIntervalTimer = null;
  }

  setStatus(status) {
    this.status = status;
    this.emit("statusChange", this.status);
  }
}
