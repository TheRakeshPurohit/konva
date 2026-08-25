import type { Container } from './Container.ts';
import { Konva } from './Global.ts';
import type { Node } from './Node.ts';
import type { Vector2d } from './types.ts';
import { Util } from './Util.ts';

type DragElement = {
  node: Node;
  startPointerPos: Vector2d;
  offset: Vector2d;
  pointerId?: number;
  startEvent?: any;
  // when we just put pointer down on a node
  // it will create drag element
  dragStatus: 'ready' | 'dragging' | 'stopped';
};

export const DD = {
  get isDragging() {
    let flag = false;
    DD._dragElements.forEach((elem) => {
      if (elem.dragStatus === 'dragging') {
        flag = true;
      }
    });
    return flag;
  },
  justDragged: false,
  get node() {
    // return first dragging node
    let node: Node | undefined;
    DD._dragElements.forEach((elem) => {
      node = elem.node;
    });
    return node;
  },
  _dragElements: new Map<number, DragElement>(),

  // Konva is imported into one window, but a stage may be rendered in another
  // one: an iframe, or a window opened with `window.open`. Such a window sends
  // its pointer events to itself, so `Konva.Stage` asks for every window it is
  // rendered in. The handlers get the window they listen to, as only that
  // window has pointer positions the stages of that window can use
  _listenToWindow(win: Window) {
    const endDragBefore = (evt) => DD._endDragBefore(evt, win);
    const drag = (evt) => DD._drag(evt, win);

    win.addEventListener('mouseup', endDragBefore, true);
    win.addEventListener('touchend', endDragBefore, true);
    // add touchcancel to fix this: https://github.com/konvajs/konva/issues/1843
    win.addEventListener('touchcancel', endDragBefore, true);

    win.addEventListener('mousemove', drag);
    win.addEventListener('touchmove', drag);

    win.addEventListener('mouseup', DD._endDragAfter, false);
    win.addEventListener('touchend', DD._endDragAfter, false);
    win.addEventListener('touchcancel', DD._endDragAfter, false);
  },

  // methods
  _drag(evt, win?: Window) {
    const nodesToFireEvents: Array<Node> = [];
    DD._dragElements.forEach((elem, key) => {
      const { node } = elem;
      // we need to find pointer relative to that node
      const stage = node.getStage()!;
      // a pointer position of another window is relative to another viewport,
      // it would drag the node to a random place
      if (win && stage._getOwnerWindow() !== win) {
        return;
      }
      stage.setPointersPositions(evt);

      // it is possible that user call startDrag without any event
      // it that case we need to detect first movable pointer and attach it into the node
      if (elem.pointerId === undefined) {
        elem.pointerId = Util._getFirstPointerId(evt);
      }
      const pos = stage._changedPointerPositions.find(
        (pos) => pos.id === elem.pointerId
      );

      // not related pointer
      if (!pos) {
        return;
      }
      if (elem.dragStatus !== 'dragging') {
        const dragDistance = node.dragDistance();
        const distance = Math.max(
          Math.abs(pos.x - elem.startPointerPos.x),
          Math.abs(pos.y - elem.startPointerPos.y)
        );
        if (distance < dragDistance) {
          return;
        }
        node.startDrag({ evt });
        // a user can stop dragging inside `dragstart`
        if (!node.isDragging()) {
          return;
        }
      }
      node._setDragPosition(evt, elem);
      nodesToFireEvents.push(node);
    });
    // call dragmove only after ALL positions are changed
    nodesToFireEvents.forEach((node) => {
      // node may have been destroyed during a previous dragmove handler
      if (!node.getStage()) {
        return;
      }
      node.fire(
        'dragmove',
        {
          type: 'dragmove',
          target: node,
          evt: evt,
        },
        true
      );
    });
  },

  // dragBefore and dragAfter allows us to set correct order of events
  // setup all in dragbefore, and stop dragging only after pointerup triggered.
  _endDragBefore(evt?, win?: Window) {
    const drawNodes: Array<Container> = [];
    DD._dragElements.forEach((elem) => {
      const { node } = elem;
      // we need to find pointer relative to that node
      const stage = node.getStage()!;
      // a pointer released in another window ends the drag too - the pointer
      // is up everywhere - but its position is not used for this stage
      if (evt && (!win || stage._getOwnerWindow() === win)) {
        stage.setPointersPositions(evt);
      }

      const pos = stage._changedPointerPositions.find(
        (pos) => pos.id === elem.pointerId
      );

      // that pointer is not related
      if (!pos) {
        return;
      }

      if (elem.dragStatus === 'dragging' || elem.dragStatus === 'stopped') {
        // if a node is stopped manually we still need to reset events:
        DD.justDragged = true;
        Konva._mouseListenClick = false;
        Konva._touchListenClick = false;
        Konva._pointerListenClick = false;
        elem.dragStatus = 'stopped';
      }

      const drawNode =
        elem.node.getLayer() ||
        ((elem.node instanceof Konva['Stage'] && elem.node) as any);

      if (drawNode && drawNodes.indexOf(drawNode) === -1) {
        drawNodes.push(drawNode);
      }
    });
    // draw in a sync way
    // because mousemove event may trigger BEFORE batch draw is called
    // but as we have not hit canvas updated yet, it will trigger incorrect mouseover/mouseout events
    drawNodes.forEach((drawNode) => {
      drawNode.draw();
    });
  },
  _endDragAfter(evt) {
    DD._dragElements.forEach((elem, key) => {
      if (elem.dragStatus === 'stopped') {
        elem.node.fire(
          'dragend',
          {
            type: 'dragend',
            target: elem.node,
            evt: evt,
          },
          true
        );
      }
      if (elem.dragStatus !== 'dragging') {
        DD._dragElements.delete(key);
      }
    });
  },
};
