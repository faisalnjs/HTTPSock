# HTTP/S WebSockets (HTTPSock)

WebSocket-like data streaming over HTTP/S with Express.js and Node.js. Supports multiple servers, broadcasters, and clients, without the WebSocket protocol.

Lightweight wrapper, HTTP chunked responses, continuous streaming, authentication, rooms.

![Demo](./demo.gif)

3 main implementations:

- `httpsock/server` - bind `httpsock/server` to an Express.js app route to convert it into a streaming server endpoint. Accepts POST for sending and GET for streaming.
- `httpsock/broadcast` - broadcast text, JSON, image, buffer data to a `httpsock/server` endpoint.
- `httpsock/client` - connect to a `httpsock/server` stream endpoint and receive incoming data.

![Setup](./setup.png)

## Installation

Install the `httpsock` package from NPM:

```powershell
npm install httpsock
```

Then, import the modules in your Node.js (Express.js for servers) project as needed.

Note that if the server is running on HTTPS, a certificate chain (whether self-signed or not) must be provided for secure connections. If a broadcaster or client is attempting to connect to an HTTPS server, they too must be provided the same certificate chain.

## Local Demo

There are ready-made demos in the [`demos`](demos) folder. To quickly test `httpsock`, open the following in 3 separate terminal windows:

- Start a demo server (choose one):

```powershell
node demos/server/index.js # generic server

node demos/server/rooms.js # server with rooms
node demos/server/roomRedirects.js # server with rooms and simple redirects
node demos/server/customAuth.js # server with custom authentication functions
```

- Start a client to observe the stream (choose one):

```powershell
node demos/client/local.js # generic local client

node demos/client/localImage.js # image client
node demos/client/localGIF.js # GIF reconstruction client

node demos/client/index.js # production client
```

- Start a broadcaster (choose matching):

```powershell
node demos/broadcast/local.js # generic local broadcaster

node demos/broadcast/localJSON.js # JSON broadcaster
node demos/broadcast/localGIF.js # GIF broadcaster
node demos/broadcast/localImage.js # image broadcaster

node demos/broadcast/index.js # production broadcaster
```

The demos demonstrate how to run a server, broadcast binary (images/GIF) and JSON/text messages, and connect clients that parse messages automatically. You'll likely need to fine-tune these scripts so that they fit your use case and data formats.

## Usage

### server (Express.js)

The server exposes a function that returns an Express `Router`. Example usage in an Express app:

```js
const express = require('express');
const HTTPSockServer = require('httpsock/server');
// import HTTPSockServer from 'httpsock/server.mjs';

const app = express();
app.use('/httpsock', HTTPSockServer({
    maxBody: '10mb', // max POST size
    auth: true, // require HTTP Basic auth for clients/broadcasters
    clients: [{ username: 'user', password: 'pass' }], // credentials array format is interchangeable
    broadcasts: (username, password) => { // or use function format
        if ((username === 'user') && (password === 'pass')) return true;
        return false;
    },
    callback: ((authenticatedAs, message) => console.log(`←→ ${authenticatedAs}:`, message))
}));

app.listen(3000, () => console.log('listening on :3000'));
```

- GET /httpsock (used by clients) keeps the response open and sends framed messages as they arrive.
- POST /httpsock (used by broadcasters) accepts a body (any content type). Bodies are queued and delivered to connected clients.
- If `auth` is enabled the server expects HTTP Basic auth.
  - The `clients` and `broadcasts` arrays define allowed credentials. Each entry may be:
    - an object: `{ username: 'user', password: 'pass' }`
    - an array: `['user', 'pass']`
    - a string: `'user:pass'`
  - Alternatively, `clients` and `broadcasts` can be set to functions: `(username, password) => true|false`
- The server sets `Transfer-Encoding: chunked` and uses an internal queue to handle bursts and backpressure.
- The `callback` function is called with each incoming POST body, after authentication. authenticatedAs and response are passed in, representing the authenticated broadcaster and their message respectively.

### broadcaster

Use `httpsock/broadcast` to POST data to `httpsock/server`.

Example:

```js
const HTTPSockBroadcast = require('httpsock/broadcast');
// import HTTPSockBroadcast from 'httpsock/broadcast.mjs';

const broadcaster = new HTTPSockBroadcast({
    server: 'http://localhost:1234/httpsock',
    cert: './certs/chain.pem', // optional, only needed if the server is running on HTTPS
    auth: 'user:pass',
    callback: (response => console.log('→', response)),
    close: (() => console.log('↓ stream closed')),
    error: (error => console.error(error))
});

broadcaster.send({ type: 'test', now: Date.now() });
broadcaster.send(Buffer.from([0x01, 0x02]));
broadcaster.send('plain text message');
broadcaster.stop();
```

- Emits `callback` on each confirmation message, `close` when the stream ends, and `error` on connection or parsing errors.
- If the server requires authentication, it must be provided in the `auth` option.
- If the server is running on HTTPS, the broadcaster must also be provided the same certificate chain for secure connections.
- The `send` method automatically sets a Content-Type header based on the payload (application/json for objects, text/plain for strings, application/octet-stream for Buffer).

### client

Use `httpsock/client` to connect to a `httpsock/server`'s GET endpoint and intercept a data stream.

Example:

```js
const HTTPSockClient = require('httpsock/client');
// import HTTPSockClient from 'httpsock/client.mjs';

const client = new HTTPSockClient({
    server: 'http://localhost:1234/httpsock',
    cert: './certs/chain.pem', // optional, only needed if the server is running on HTTPS
    auth: 'user:pass',
    callback: (response => console.log('→', response)),
    close: (() => console.log('↓ stream closed')),
    error: (error => console.error('↓', error))
});

client.stream();
client.stop();
```

- Emits `callback` on each incoming message, `close` when the stream ends, and `error` on connection or parsing errors.
- If the server requires authentication, it must be provided in the `auth` option.
- If the server is running on HTTPS, the client must also be provided the same certificate chain for secure connections.

## HTTPS Certificates

A signed certificate chain is only required for servers running on HTTPS. The server, broadcasters, and clients must be provided the same certificate chain (whether self-signed or not) for secure connections. By default, the certificate will be loaded from the `cert` option path, defaulting to `./certs/chain.pem` if not provided.

When running the server locally, no certificate is required.

## Proof of Concept

This package was successfully used to relay live streamed video camera feed from a connected Raspberry Pi (broadcaster) to an external machine (server) and then to a hosted website on the frontend (client). Related demo files can be found as `server/imageStream.js`, `broadcast/localImageStream.js`, and `client/localImageStream.js`.

## License

HTTPSock/`httpsock` is licensed under ISC. (c) 2026 Faisal Nageer. This concept has likely been implemented before, but this package was created so that I could learn how to implement it myself and so that it fit the specific use cases for my projects.
