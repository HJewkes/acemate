import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import type { Controller, ControlState } from "../control/controller";
import { NO_RUN, type RunInfo } from "../launcher/run-chip";
import type { FireMessage } from "@acemate/core";
import type { SavedRobot } from "../storage/settings";
import { AUTO_CONNECT, openRobot } from "./ble-channel";
import type { LaunchListener } from "./launch-link";
import { describeMessage } from "./messages";
import { RobotSession } from "./session";

export type LinkStatus = "disconnected" | "scanning" | "connecting" | "connected";

const TICK_MS = 10;
const LOG_LINES = 8;

export interface LaunchView {
  /** car_state.bat from the last heartbeat; null until one arrives or when the robot omits it. */
  battery: number | null;
  /** car_state.running from the last heartbeat. */
  robotRunning: boolean;
  /** The LaunchController's own run tracking, which also holds driving at stop. */
  runActive: boolean;
  /** A fire is waiting for rsp_set_mode. */
  inFlight: boolean;
  /** Mode and start of the latest run, for the run chip. */
  run: RunInfo;
  log: string[];
  /** When log[0] arrived, so a repeat of the same text still counts as new. */
  reportedAt: number;
}

export interface RobotView {
  status: LinkStatus;
  detail: string;
  control: ControlState;
  log: string[];
  launch: LaunchView;
  /** The robot this session is linked to; null unless connected. */
  current: SavedRobot | null;
  /** Connects to this robot, dropping any other first; null picks any (the browser's chooser on web). */
  connectTo(robot: SavedRobot | null): void;
  disconnect(): void;
  fire(message: FireMessage): void;
  stopRun(): void;
  /** Writes stop at once, then run_stop. */
  emergencyStop(): void;
}

const NO_LAUNCH: LaunchView = {
  battery: null,
  robotRunning: false,
  runActive: false,
  inFlight: false,
  run: NO_RUN,
  log: [],
  reportedAt: 0,
};

/** The panel's view of launches, fed by the session's LaunchLink and refreshed from the tick loop. */
function useLaunchView() {
  const [launch, setLaunch] = useState<LaunchView>(NO_LAUNCH);
  const listener = useMemo<LaunchListener>(
    () => ({
      report: (text) =>
        setLaunch((view) => ({ ...view, log: [text, ...view.log].slice(0, LOG_LINES), reportedAt: Date.now() })),
      carState: (car) =>
        setLaunch((view) => ({
          ...view,
          battery: typeof car.bat === "number" ? car.bat : null,
          robotRunning: car.running === true,
        })),
    }),
    [],
  );
  const setRunState = useCallback(
    (runActive: boolean, inFlight: boolean, run: RunInfo) =>
      setLaunch((view) =>
        view.runActive === runActive && view.inFlight === inFlight && view.run === run
          ? view
          : { ...view, runActive, inFlight, run },
      ),
    [],
  );
  return { launch, listener, setRunState };
}

interface RobotOptions {
  /** The robot to auto-connect to on launch and on returning to the app; null until loaded or if none. */
  lastRobot: SavedRobot | null;
  onConnected(robot: SavedRobot): void;
  allowDriveDuringRun: boolean;
  /** Applied to each channel live, so the web debug menu can lower it mid-session. */
  maxUnackedWrite: number;
}

/** Owns the BLE session: ticks the controller into the drive loop and stops the robot when the app leaves the foreground. */
export function useRobot(controller: Controller, options: RobotOptions): RobotView {
  const session = useRef<RobotSession | null>(null);
  // Bumped by every disconnect, so a scan that finishes after the user (or a backgrounding) cancelled it is closed.
  const attempt = useRef(0);
  const busy = useRef(false);
  const [status, setStatus] = useState<LinkStatus>("disconnected");
  const [detail, setDetail] = useState("");
  const [current, setCurrent] = useState<SavedRobot | null>(null);
  const [control, setControl] = useState<ControlState>({ motion: "stop", latched: false });
  const [log, setLog] = useState<string[]>([]);
  const { launch, listener, setRunState } = useLaunchView();

  const appendLog = useCallback((line: string) => setLog((lines) => [line, ...lines].slice(0, LOG_LINES)), []);

  // An explicit Disconnect pauses auto-connect until the next launch or a connect from the device menu.
  const userDisconnected = useRef(false);
  const optionsRef = useRef(options);
  // A layout effect, so the auto-connect effect below already sees this render's options.
  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const drop = useCallback(() => {
    const closing = session.current;
    session.current = null;
    attempt.current++;
    setStatus("disconnected");
    setCurrent(null);
    void closing?.shutdown();
  }, []);

  const open = useCallback(
    (prefer: SavedRobot | null) => {
      if (session.current || busy.current) return;
      busy.current = true;
      const mine = ++attempt.current;
      // A replaced session's late disconnect must not touch the status or name of the one that replaced it.
      const onDrop = (why: string) => {
        if (attempt.current !== mine) return;
        drop();
        setDetail(why);
      };
      const onConnected = (robot: SavedRobot) => {
        setCurrent(robot);
        optionsRef.current.onConnected(robot);
      };
      void openSession({ appendLog, setStatus, setDetail, onDrop, launch: listener, prefer, onConnected }).then(
        (opened) => {
          busy.current = false;
          if (attempt.current === mine) session.current = opened;
          else if (opened) void opened.shutdown().finally(() => (setStatus("disconnected"), setCurrent(null)));
        },
      );
    },
    [appendLog, drop, listener],
  );

  const connectTo = useCallback(
    (robot: SavedRobot | null) => {
      userDisconnected.current = false;
      if (session.current) drop();
      open(robot);
    },
    [drop, open],
  );
  const disconnect = useCallback(() => {
    userDisconnected.current = true;
    drop();
  }, [drop]);
  const autoConnect = useCallback(() => {
    const last = optionsRef.current.lastRobot;
    if (AUTO_CONNECT && last && !userDisconnected.current) open(last);
  }, [open]);

  useEffect(() => {
    autoConnect();
  }, [options.lastRobot?.id, autoConnect]);

  const withSession = useCallback(
    (action: (current: RobotSession) => Promise<void>) => {
      if (session.current) void action(session.current);
      else listener.report("Not connected.");
    },
    [listener],
  );
  const fire = useCallback(
    (message: FireMessage) => withSession((current) => current.launch.handle(message)),
    [withSession],
  );
  const stopRun = useCallback(() => withSession((current) => current.launch.handle({ kind: "stop" })), [withSession]);
  const emergencyStop = useCallback(() => session.current?.emergencyStop(), []);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = controller.read();
      setControl((shown) => (shown.motion === next.motion && shown.latched === next.latched ? shown : next));
      if (session.current) {
        session.current.allowDriveDuringRun = optionsRef.current.allowDriveDuringRun;
        session.current.channel.maxUnackedWrite = optionsRef.current.maxUnackedWrite;
      }
      session.current?.drive(next.motion);
      session.current?.tick();
      const launch = session.current?.launch;
      setRunState(launch?.running ?? false, launch?.inFlight ?? false, launch?.run ?? NO_RUN);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [controller, setRunState]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        autoConnect();
        return;
      }
      // run_stop is queued ahead of shutdown's stop, so a launch run ends too.
      session.current?.emergencyStop();
      drop();
    });
    return () => {
      subscription.remove();
      drop();
    };
  }, [drop, autoConnect]);

  return {
    status,
    detail,
    control,
    log,
    launch,
    current,
    connectTo,
    disconnect,
    fire,
    stopRun,
    emergencyStop,
  };
}

interface SessionHooks {
  /** Connect only to this robot; null takes any. */
  prefer: SavedRobot | null;
  onConnected(robot: SavedRobot): void;
  appendLog(line: string): void;
  setStatus(status: LinkStatus): void;
  setDetail(detail: string): void;
  onDrop(why: string): void;
  launch: LaunchListener;
}

async function openSession(hooks: SessionHooks): Promise<RobotSession | null> {
  const { appendLog, setStatus, setDetail, onDrop, launch, prefer, onConnected } = hooks;
  try {
    setStatus("scanning");
    const { id, channel } = await openRobot(prefer, () => setStatus("connecting"));
    const opened = new RobotSession(channel, (message) => appendLog(describeMessage(message)));
    opened.launch.listen(launch);
    channel.onDisconnect(() => onDrop(`${channel.name} disconnected`));
    setStatus("connected");
    setDetail(channel.name);
    onConnected({ id, name: channel.name });
    return opened;
  } catch (error) {
    setStatus("disconnected");
    setDetail(error instanceof Error ? error.message : String(error));
    return null;
  }
}
