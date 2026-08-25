import { assert } from 'chai';
import { Konva, isBrowser } from './test-utils.ts';

// A stage may be rendered in another window than the one Konva was imported
// into: an iframe, or a window opened with `window.open`. Such a window sends
// its own events and gives its own frames. The tests below use an iframe,
// because a test runner can not open a window, but for Konva the two are the
// same case.
describe('Owner window', function () {
  let iframe: HTMLIFrameElement;
  let frameWindow: Window;
  let frameDocument: Document;

  beforeEach(function () {
    if (!isBrowser) {
      return;
    }
    iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    frameWindow = iframe.contentWindow!;
    frameDocument = iframe.contentDocument!;
  });

  afterEach(function () {
    if (!isBrowser) {
      return;
    }
    iframe.remove();
  });

  function addFrameStage() {
    const container = frameDocument.createElement('div');
    frameDocument.body.appendChild(container);
    return new Konva.Stage({ container, width: 200, height: 200 });
  }

  // a real event, as the browser makes it, in the given window
  function dispatchMouse(
    target: EventTarget,
    win: Window,
    type: string,
    client: { x: number; y: number }
  ) {
    target.dispatchEvent(
      new (win as any).MouseEvent(type, {
        clientX: client.x,
        clientY: client.y,
        button: 0,
        buttons: type === 'mouseup' ? 0 : 1,
        bubbles: true,
        cancelable: true,
        view: win,
      })
    );
  }

  // position inside the stage -> position inside the window of the stage
  function toClient(stage: any, pos: { x: number; y: number }) {
    const rect = stage.content.getBoundingClientRect();
    return { x: rect.left + pos.x, y: rect.top + pos.y };
  }

  function addDraggableRect(stage: any) {
    const layer = new Konva.Layer();
    const rect = new Konva.Rect({
      x: 10,
      y: 10,
      width: 40,
      height: 40,
      draggable: true,
      fill: 'red',
    });
    layer.add(rect);
    stage.add(layer);
    return rect;
  }

  it('creates the stage content in the document of the container', function () {
    if (!isBrowser) {
      return;
    }
    const stage = addFrameStage();

    assert.equal(stage.content.ownerDocument, frameDocument);
    assert.equal(stage._getOwnerWindow(), frameWindow);
    stage.destroy();
  });

  it('drags with the events of the window of the stage', function () {
    if (!isBrowser) {
      return;
    }
    const stage = addFrameStage();
    const rect = addDraggableRect(stage);
    let dragMoves = 0;
    let dragEnds = 0;
    rect.on('dragmove', () => dragMoves++);
    rect.on('dragend', () => dragEnds++);

    dispatchMouse(
      stage.content,
      frameWindow,
      'mousedown',
      toClient(stage, { x: 20, y: 20 })
    );
    dispatchMouse(
      frameWindow,
      frameWindow,
      'mousemove',
      toClient(stage, { x: 60, y: 60 })
    );

    assert.isTrue(rect.isDragging(), 'is dragging');
    assert.isAbove(dragMoves, 0, 'dragmove fired');
    assert.deepEqual({ x: rect.x(), y: rect.y() }, { x: 50, y: 50 });

    dispatchMouse(
      frameWindow,
      frameWindow,
      'mouseup',
      toClient(stage, { x: 60, y: 60 })
    );

    assert.isFalse(rect.isDragging(), 'drag stopped');
    assert.equal(dragEnds, 1, 'dragend fired');
    stage.destroy();
  });

  it('ignores moves of another window while dragging', function () {
    if (!isBrowser) {
      return;
    }
    // a stage in the iframe makes Konva listen to the iframe window
    const frameStage = addFrameStage();

    // a stage of the main window is dragged
    const container = document.createElement('div');
    document.body.appendChild(container);
    const stage = new Konva.Stage({ container, width: 200, height: 200 });
    const rect = addDraggableRect(stage);
    dispatchMouse(
      stage.content,
      window,
      'mousedown',
      toClient(stage, { x: 20, y: 20 })
    );
    dispatchMouse(
      window,
      window,
      'mousemove',
      toClient(stage, { x: 30, y: 30 })
    );
    assert.deepEqual(
      { x: rect.x(), y: rect.y() },
      { x: 20, y: 20 },
      'drag started'
    );

    // the pointer moves inside the iframe. Its position is in the viewport of
    // the iframe and must not move the node of the main window
    dispatchMouse(frameWindow, frameWindow, 'mousemove', { x: 150, y: 150 });
    assert.deepEqual(
      { x: rect.x(), y: rect.y() },
      { x: 20, y: 20 },
      'node did not move'
    );

    // the drag continues in its own window
    dispatchMouse(
      window,
      window,
      'mousemove',
      toClient(stage, { x: 40, y: 40 })
    );
    assert.deepEqual(
      { x: rect.x(), y: rect.y() },
      { x: 30, y: 30 },
      'drag continues'
    );

    rect.stopDrag();
    stage.destroy();
    frameStage.destroy();
    container.remove();
  });

  it('stops the drag when the pointer is released in another window', function () {
    if (!isBrowser) {
      return;
    }
    const stage = addFrameStage();
    const rect = addDraggableRect(stage);
    let dragEnds = 0;
    rect.on('dragend', () => dragEnds++);

    dispatchMouse(
      stage.content,
      frameWindow,
      'mousedown',
      toClient(stage, { x: 20, y: 20 })
    );
    dispatchMouse(
      frameWindow,
      frameWindow,
      'mousemove',
      toClient(stage, { x: 60, y: 60 })
    );
    assert.isTrue(rect.isDragging());

    // the pointer is released outside of the window of the stage
    dispatchMouse(window, window, 'mouseup', { x: 0, y: 0 });

    assert.isFalse(rect.isDragging(), 'drag stopped');
    assert.equal(dragEnds, 1, 'dragend fired');
    assert.deepEqual(
      { x: rect.x(), y: rect.y() },
      { x: 50, y: 50 },
      'node kept its position'
    );
    stage.destroy();
  });

  it('transforms with the events of the window of the stage', function () {
    if (!isBrowser) {
      return;
    }
    const stage = addFrameStage();
    const layer = new Konva.Layer();
    const rect = new Konva.Rect({
      x: 20,
      y: 20,
      width: 50,
      height: 50,
      fill: 'green',
    });
    layer.add(rect);
    const tr = new Konva.Transformer({ nodes: [rect] });
    layer.add(tr);
    stage.add(layer);
    layer.draw();

    const pos = tr.findOne('.bottom-right')!.getAbsolutePosition();
    dispatchMouse(
      stage.content,
      frameWindow,
      'mousedown',
      toClient(stage, pos)
    );
    dispatchMouse(
      frameWindow,
      frameWindow,
      'mousemove',
      toClient(stage, {
        x: pos.x + 50,
        y: pos.y + 50,
      })
    );

    assert.closeTo(rect.width() * rect.scaleX(), 100, 0.001, 'width changed');
    assert.closeTo(rect.height() * rect.scaleY(), 100, 0.001, 'height changed');

    dispatchMouse(
      frameWindow,
      frameWindow,
      'mouseup',
      toClient(stage, {
        x: pos.x + 50,
        y: pos.y + 50,
      })
    );
    assert.isFalse(tr._transforming, 'transform ended');
    stage.destroy();
  });

  it('draws with the frames of the window of the stage', function (done) {
    if (!isBrowser) {
      return done();
    }
    const stage = addFrameStage();
    const layer = new Konva.Layer();
    stage.add(layer);

    const original = frameWindow.requestAnimationFrame;
    let frameRequests = 0;

    // wait for the draw the stage asked for on its own, so that the layer is
    // not waiting for a frame anymore
    original.call(frameWindow, () => {
      frameWindow.requestAnimationFrame = function (cb) {
        frameRequests++;
        return original.call(frameWindow, cb);
      };

      layer.batchDraw();

      frameWindow.requestAnimationFrame = original;
      stage.destroy();
      try {
        assert.isAbove(frameRequests, 0, 'a frame of the iframe was asked for');
        done();
      } catch (e) {
        done(e);
      }
    });
  });

  it('redraws when the window of the stage becomes visible', function () {
    if (!isBrowser) {
      return;
    }
    const stage = addFrameStage();
    let draws = 0;
    stage.batchDraw = function () {
      draws++;
      return this;
    };

    frameDocument.dispatchEvent(
      new (frameWindow as any).Event('visibilitychange')
    );

    assert.isAbove(draws, 0, 'the stage was redrawn');
    stage.destroy();
  });

  it('moves a stage to another window', function () {
    if (!isBrowser) {
      return;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    const stage = new Konva.Stage({ container, width: 200, height: 200 });
    const rect = addDraggableRect(stage);

    const frameContainer = frameDocument.createElement('div');
    frameDocument.body.appendChild(frameContainer);
    stage.container(frameContainer);

    assert.equal(stage._getOwnerWindow(), frameWindow);
    assert.equal(stage.content.ownerDocument, frameDocument);

    // the canvas keeps its content in the new document
    const layer = stage.getLayers()[0];
    const ratio = layer.getCanvas().getPixelRatio();
    layer.draw();
    const data = layer
      .getContext()
      .getImageData(20 * ratio, 20 * ratio, 1, 1).data;
    assert.deepEqual(Array.from(data), [255, 0, 0, 255], 'the rect is drawn');

    // and it drags with the events of the new window
    dispatchMouse(
      stage.content,
      frameWindow,
      'mousedown',
      toClient(stage, { x: 20, y: 20 })
    );
    dispatchMouse(
      frameWindow,
      frameWindow,
      'mousemove',
      toClient(stage, { x: 60, y: 60 })
    );
    assert.deepEqual({ x: rect.x(), y: rect.y() }, { x: 50, y: 50 });
    dispatchMouse(
      frameWindow,
      frameWindow,
      'mouseup',
      toClient(stage, { x: 60, y: 60 })
    );

    stage.destroy();
    container.remove();
  });

  it('removes the content of a destroyed stage', function () {
    if (!isBrowser) {
      return;
    }
    const stage = addFrameStage();
    const container = stage.container();

    assert.equal(container.children.length, 1);
    stage.destroy();
    assert.equal(container.children.length, 0, 'content removed');
  });
});
