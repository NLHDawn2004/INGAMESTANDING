import gradient from "gradient-string"
import chalk from "chalk"

export const gradients: { primary: any, second: any, success: any, warn: any, error: any } = {
  primary: gradient(['#7b4397', '#dc2430']),
  second: gradient(['#1a2a6c', '#b21f1f', '#fdbb2d']),

  success: gradient(['#22c1c3', '#fdbb2d']),
  warn: gradient(["#f12711", '#f5af19']),
  error: gradient(["#ED213A", '#93291E'])
}

export default function logger(header: string, data: string, option?: "error" | "warn" | "success" | "info" | "") {
  switch (option) {
    case "error":
      console.log(`${chalk.bold(`${header}`)} » ${chalk.bgRed("ERR!")} ${gradients.error(data)}`)
      break;

    case "warn":
      console.log(`${chalk.bold(`${header}`)} » ${chalk.bgYellow("WARN")} ${gradients.warn(data)}`)
      break;

    case "success":
      console.log(`${chalk.bold(`${header}`)} » ${chalk.bgGreen("SUCCESS")} ${gradients.success(data)}`)
      break;

    case "info":
      console.log(`${chalk.bold(`${header}`)} » ${chalk.bgBlue("INFO")} ${gradients.second(data)}`)
      break;

    default:
      console.log(`${chalk.bold(`${header}`)} » ${gradients.primary(data)}`)
      break;
  }
}