import { useEffect, useRef } from "react";
import type { PadSnapshot } from "./gamepad";
import { WebInput, type InputActions } from "./web-input";

const POLL_MS = 50;
const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || TYPING_TAGS.has(target.tagName));
}

// Browsers without the Gamepad API (Bluefy, older Safari) simply never report a pad.
function firstPad(): PadSnapshot | null {
  if (typeof navigator.getGamepads !== "function") return null;
  return navigator.getGamepads().find((pad) => pad?.connected === true) ?? null;
}

/** Feeds real key-down/key-up events and a polled gamepad to WebInput, and releases everything when the page is left. */
export function useWebInput(makeActions: () => InputActions, enabled: boolean): void {
  const input = useRef<WebInput | null>(null);
  useEffect(() => {
    const created = new WebInput(makeActions());
    input.current = created;
    return bindPage(created);
  }, [makeActions]);
  useEffect(() => {
    input.current?.setEnabled(enabled);
  }, [enabled]);
}

function bindPage(input: WebInput): () => void {
  const unbind = [bindKeys(input), bindLeave(input), pollGamepad(input)];
  return () => unbind.forEach((dispose) => dispose());
}

function bindKeys(input: WebInput): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
    if (input.keyDown(event.code, event.repeat)) event.preventDefault();
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (input.keyUp(event.code)) event.preventDefault();
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}

function bindLeave(input: WebInput): () => void {
  const onBlur = () => input.leave("blur");
  const onVisibility = () => {
    if (document.visibilityState === "hidden") input.leave("hidden");
  };
  const onPageHide = () => input.leave("pagehide");
  window.addEventListener("blur", onBlur);
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

// Only a focused page reads the pad, so a controller in another window never drives this one.
function pollGamepad(input: WebInput): () => void {
  let last = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    if (document.hasFocus()) input.poll(firstPad(), now - last);
    last = now;
  }, POLL_MS);
  return () => clearInterval(timer);
}
