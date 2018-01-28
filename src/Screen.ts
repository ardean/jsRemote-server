import * as robot from "robotjs";

export default class Screen {
  width: number;
  height: number;

  constructor() {
    this.refreshSize();
  }

  refreshSize() {
    const size = robot.getScreenSize();
    this.width = size.width;
    this.height = size.height;
  }
}
