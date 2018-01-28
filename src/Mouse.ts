import * as robot from "robotjs";
import Screen from "./Screen";

robot.setMouseDelay(0);

export default class Mouse {
  x: number;
  y: number;
  screen: Screen;
  pressedKeys: { [key: string]: boolean } = {};

  constructor(screen: Screen) {
    this.screen = screen;
    this.pullPosition();
    this.pressedKeys = {};
  }

  pullPosition() {
    const position = robot.getMousePos();
    this.x = position.x;
    this.y = position.y;
  }

  down(key) {
    if (this.pressedKeys[key]) this.up(key);

    this.pressedKeys[key] = true;
    robot.mouseToggle("down", key);
  }

  up(key) {
    if (!this.pressedKeys[key]) return;

    this.pressedKeys[key] = false;
    robot.mouseToggle("up", key);
  }

  move(movementX, movementY) {
    this.x += movementX;
    this.y += movementY;

    this.x = Math.max(this.x, 0);
    this.x = Math.min(this.x, this.screen.width);
    this.y = Math.max(this.y, 0);
    this.y = Math.min(this.y, this.screen.height);

    robot.moveMouse(this.x, this.y);
  }

  scroll(amount, direction) {
    robot.scrollMouse(direction === "up" ? amount : -amount, 0);
  }
}