import { WebSocket } from 'ws';

export class ComfyWebSocketAdapter {
  static CONNECTING = WebSocket.CONNECTING;
  static OPEN = WebSocket.OPEN;
  static CLOSING = WebSocket.CLOSING;
  static CLOSED = WebSocket.CLOSED;

  constructor(url, options) {
    this.socket = new WebSocket(url, options);
    this.socket.binaryType = 'arraybuffer';

    this.socket.on('open', () => {
      if (typeof this.onopen === 'function') {
        this.onopen();
      }
    });
    this.socket.on('close', (code, reason) => {
      if (typeof this.onclose === 'function') {
        this.onclose({ code, reason });
      }
    });
    this.socket.on('error', (err) => {
      if (typeof this.onerror === 'function') {
        this.onerror(err);
      }
    });
    this.socket.on('message', (data, isBinary) => {
      if (typeof this.onmessage !== 'function') return;
      let payload = data;
      if (isBinary) {
        if (data instanceof ArrayBuffer) {
          payload = data;
        } else if (Buffer.isBuffer(data)) {
          payload = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        }
      } else if (Buffer.isBuffer(data)) {
        payload = data.toString();
      } else if (typeof data !== 'string') {
        payload = String(data);
      }
      this.onmessage({ data: payload });
    });
  }

  get readyState() {
    return this.socket.readyState;
  }

  send(data) {
    this.socket.send(data);
  }

  close() {
    this.socket.close();
  }
}
