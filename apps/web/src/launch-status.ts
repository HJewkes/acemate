export function showLaunchStatus(text: string): void {
  const log = document.getElementById("l-status") as HTMLElement;
  log.textContent = `${new Date().toLocaleTimeString()}  ${text}\n${log.textContent ?? ""}`.slice(0, 2000);
}
