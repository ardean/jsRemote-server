import { EventEmitter } from "events";
import * as path from "path";
import * as express from "express";
import * as createBonjour from "bonjour";
import * as createSocketIOServer from "socket.io";
import Screen from "./Screen";
import Mouse from "./Mouse";
import Keyboard from "./Keyboard";
import { Server } from "net";

const bonjour = createBonjour();
const bonjourNamespace = "io-github-ardean-jsremote";

export default class JSRemoteServer extends EventEmitter {
  bonjour: boolean;
  bonjourService: any;
  refreshIntervalTimer: NodeJS.Timer = null;
  status: string = "Stopped";
  webroot: string;
  io: SocketIO.Namespace;
  socket: Server;
  app: express.Application;
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
    this.webroot = options.webroot;
    this.refreshInterval = options.refreshInterval || 10 * 1000;
    this.bonjour = typeof options.bonjour === "boolean" ? options.bonjour : true;
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
      this.socket = this.app.listen(this.port, () => {
        this.startRefreshInterval();
        this.setStatus("Started");
        if (this.bonjour) {
          this.bonjourService = bonjour.publish({ name: bonjourNamespace, type: "http", port: this.port });
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

    if (this.bonjourService) {
      await new Promise((resolve) => {
        this.bonjourService.stop(() => resolve());
      });
      this.bonjourService = null;
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
