import type { ReactNode } from "react";
import type { Shot } from "../../launcher/shot";
import type { RobotView } from "../../robot/use-robot";

export interface WebShellProps {
  robot: RobotView;
  shot: Shot;
  children: ReactNode;
}

/** A phone is the frame, so the drive screen fills it; the laptop frame and side panel are web-only (WebShell.web.tsx). */
export function WebShell({ children }: WebShellProps) {
  return children;
}
