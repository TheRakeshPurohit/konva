import type { KonvaEventObject } from './Node.ts';
import { Konva } from './Global.ts';

import type { Shape } from './Shape.ts';
import type { Stage } from './Stage.ts';

const Captures = new Map<number, Shape | Stage>();

// we may use this module for capturing touch events too
// so make sure we don't do something super specific to pointer
const SUPPORT_POINTER_EVENTS = Konva._global['PointerEvent'] !== undefined;

export interface KonvaPointerEvent extends KonvaEventObject<PointerEvent> {
  pointerId: number;
}

export function getCapturedShape(pointerId: number) {
  return Captures.get(pointerId);
}

export function createEvent(evt: PointerEvent): KonvaPointerEvent {
  return {
    evt,
    pointerId: evt.pointerId,
  } as any;
}

export function hasPointerCapture(pointerId: number, shape: Shape | Stage) {
  return Captures.get(pointerId) === shape;
}

export function setPointerCapture(pointerId: number, shape: Shape | Stage) {
  releaseCapture(pointerId);

  const stage = shape.getStage();
  if (!stage) return;

  Captures.set(pointerId, shape);

  if (SUPPORT_POINTER_EVENTS) {
    // capture on the DOM level too, so the stage keeps receiving the events
    // of that pointer even when it moves outside of the stage container
    // https://github.com/konvajs/konva/issues/1992
    try {
      stage.content?.setPointerCapture(pointerId);
    } catch (e) {
      // capture is possible only for an active pointer;
      // ids of mouse and touch events (999 and touch identifiers) and
      // programmatic calls outside of a pointer event land here
    }
    shape._fire(
      'gotpointercapture',
      createEvent(new PointerEvent('gotpointercapture'))
    );
  }
}

export function releaseCapture(pointerId: number, target?: Shape | Stage) {
  const shape = Captures.get(pointerId);

  if (!shape) return;

  const stage = shape.getStage();

  Captures.delete(pointerId);

  if (SUPPORT_POINTER_EVENTS) {
    try {
      stage?.content?.releasePointerCapture(pointerId);
    } catch (e) {
      // same as in setPointerCapture: the pointer may not be active
    }
    shape._fire(
      'lostpointercapture',
      createEvent(new PointerEvent('lostpointercapture'))
    );
  }
}
