"use client";

import { useEffect } from "react";

function isSignaturePadTarget(target: EventTarget | null): SVGSVGElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest("svg.camp-signature-pad:not(.preview)") as SVGSVGElement | null;
}

function eventTargetsPad(event: PointerEvent, pad: SVGSVGElement): boolean {
  return event.target instanceof Node && pad.contains(event.target);
}

function clonePointerEvent(type: string, event: PointerEvent): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
    width: event.width,
    height: event.height,
    pressure: event.pressure,
    tangentialPressure: event.tangentialPressure,
    tiltX: event.tiltX,
    tiltY: event.tiltY,
    twist: event.twist,
    button: event.button,
    buttons: event.buttons,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey
  });
}

export function CampSignatureTouchBridge() {
  useEffect(() => {
    let activePad: SVGSVGElement | null = null;
    let activePointerId: number | null = null;
    let forwarding = false;

    function forwardToPad(type: string, event: PointerEvent) {
      if (!activePad || forwarding) return;
      forwarding = true;
      activePad.dispatchEvent(clonePointerEvent(type, event));
      forwarding = false;
    }

    function start(event: PointerEvent) {
      if (forwarding || event.pointerType === "mouse") return;
      const pad = isSignaturePadTarget(event.target);
      if (!pad) return;
      activePad = pad;
      activePointerId = event.pointerId;
    }

    function move(event: PointerEvent) {
      if (!activePad || forwarding || event.pointerType === "mouse") return;
      if (activePointerId !== null && event.pointerId !== activePointerId) return;
      event.preventDefault();
      if (!eventTargetsPad(event, activePad)) forwardToPad("pointermove", event);
    }

    function end(event: PointerEvent) {
      if (!activePad || forwarding || event.pointerType === "mouse") return;
      if (activePointerId !== null && event.pointerId !== activePointerId) return;
      event.preventDefault();
      if (!eventTargetsPad(event, activePad)) forwardToPad(event.type, event);
      activePad = null;
      activePointerId = null;
    }

    function suppressPrematureLeave(event: PointerEvent) {
      if (!activePad || forwarding || event.pointerType === "mouse") return;
      if (activePointerId !== null && event.pointerId !== activePointerId) return;
      if (eventTargetsPad(event, activePad)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    window.addEventListener("pointerdown", start, true);
    window.addEventListener("pointermove", move, { capture: true, passive: false });
    window.addEventListener("pointerup", end, { capture: true, passive: false });
    window.addEventListener("pointercancel", end, { capture: true, passive: false });
    window.addEventListener("pointerout", suppressPrematureLeave, { capture: true, passive: false });
    window.addEventListener("pointerleave", suppressPrematureLeave, { capture: true, passive: false });
    return () => {
      window.removeEventListener("pointerdown", start, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      window.removeEventListener("pointerout", suppressPrematureLeave, true);
      window.removeEventListener("pointerleave", suppressPrematureLeave, true);
    };
  }, []);

  return null;
}
