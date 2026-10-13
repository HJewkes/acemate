import type { RobotMessage } from "./session";

type Fields = Record<string, unknown>;

const asFields = (value: unknown): Fields => (value && typeof value === "object" ? (value as Fields) : {});

/** One short log line per robot message; init and heartbeat get their key fields, anything else its raw JSON. */
export function describeMessage(message: RobotMessage): string {
  if (message.type === "raw") return `raw ${String(message.line)}`;
  const data = asFields(asFields(message).data);
  if (message.type === "rsp_init_data") {
    return `init ${String(data.robot_id)} fw ${String(data.rk_software_version)} mode ${String(data.mode)}`;
  }
  if (message.type === "rsp_heartbeat") {
    const car = asFields(data.car_state);
    return `car_state mode ${String(car.mode)} running ${String(car.running)} bat ${String(car.bat)}`;
  }
  return JSON.stringify(message);
}
