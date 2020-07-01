const crypto = require('crypto');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const PaymentJsConfig = require('./paymentjs.config');

const sendResponse = (response, status, headers, data) => {
  response.writeHead(status, headers);
  if (data) {
    response.end(data, 'utf-8');
  }
  console.log('[info] [server] sent response with status ' + status);
};

const authorizeSession = (config, nonce, callback) => {
  const timestamp = new Date().getTime()

  const requestBody = JSON.stringify(config.gatewayConfig);

  const msgToSign = [
    config.credentials.apiKey,
    nonce,
    timestamp,
    requestBody,
  ].join('');

  const msgSignature = crypto
    .createHmac("sha256", config.credentials.apiSecret)
    .update(msgToSign)
    .digest("base64");

  const requestOptions = {
    hostname: config.hostname,
    port: 443,
    path: '/paymentjs/v2/merchant/authorize-session',
    method: 'POST',
    headers: {
      'Api-Key': config.credentials.apiKey,
      'Content-Type': 'application/json',
      'Message-Signature': msgSignature,
      'Nonce': nonce,
      'Timestamp': timestamp,
    },
  };

  console.log('[info] [authorizeSession] sending request');
  const request = https.request(requestOptions, (response) => {
    console.log('[info] [authorizeSession] received response with status ' + response.statusCode);
    if (response.statusCode === 200) {
      const responseNonce = response.headers['nonce'];

      // nonce should match what we used to authorize the session
      if (responseNonce === nonce) {

        // read response body
        response.setEncoding('utf8');
        response.on('data', (bodyStr) => {
          const clientToken = response.headers['client-token'];
          const publicKeyBase64 = JSON.parse(bodyStr).publicKeyBase64;
          callback(undefined, { clientToken, publicKeyBase64 });
        });
        response.on('error', (e) => {
          callback(e, undefined);
        });

      } else {
        // the nonce did not match
        callback(new Error('nonce validation failed for nonce "' + nonce + '"'));
      }
    } else {
      // unsuccessful or otherwise unexpected response status code
      callback(new Error('received HTTP ' + response.statusCode), undefined);
    };
  });

  // write the payload to the request object
  request.write(requestBody);
  request.end();
};

const nonceCache = new Map();

const readFiles = (filePaths) => {
  const files = new Map();
  for (let i = 0; i < filePaths.length; i++) {
    files.set(filePaths[i], fs.readFileSync(filePaths[i], 'utf8'));
  }
  return files;
};


const FileName = {
  JS: './client.js',
  HTML: './index.html',
  CSS: './styles.css',
};

const Mime = {
  CSS: 'text/css',
  HTML: 'text/html',
  JS: 'text/javascript',
};

const fileCache = readFiles([
  FileName.HTML,
  FileName.CSS,
  FileName.JS,
]);

const sendFile = (response, filePath, contentType) => {
  if (!fileCache.has(filePath)) {
    sendResponse(response, 500);
    return;
  }

  sendResponse(response, 200, { 'Content-Type': contentType }, fileCache.get(filePath));
};

const routes = {
  '/client.js': {
    GET: (request, response) => sendFile(response, FileName.JS, Mime.JS),
  },

  '/styles.css': {
    GET: (request, response) => sendFile(response, FileName.CSS, Mime.CSS),
  },

  '/': {
    GET: (request, response) => sendFile(response, FileName.HTML, Mime.HTML),
  },

  '/api/authorize-session': {
    POST: (request, response) => {
      const nonce = `${(new Date().getTime() + Math.random())}`;
      authorizeSession(PaymentJsConfig, nonce, (error, data) => {
        if (error) {
          sendResponse(response, 500);
          console.error('[error] [authorizeSession] ' + error.message);
          return;
        }

        nonceCache.set(data.clientToken, nonce);
        sendResponse(response, 200, { 'Content-Type': 'application/json' }, JSON.stringify(data));
      });
    },
  },

  '/api/webhook': {
    POST: (request, response) => {
      const clientToken = request.headers['client-token'];
      const nonce = request.headers['nonce'];

      const isNonceStored = nonceCache.has(clientToken);
      let requestNonce = '';
      if (isNonceStored) {
        requestNonce = nonceCache.get(clientToken);
        nonceCache.delete(clientToken);
      }

      const nonceValidated = isNonceStored && requestNonce === responseNonce;

      if (!nonceValidated) {
        sendResponse(response, 401);

        console.error(`[error] [webhook] clientToken/nonce validation failed`);
        return;
      }

      let bodyStr = '';

      request.on('data', (chunk) => {
        bodyStr += chunk.toString();
      });

      request.on('end', () => {
        tokenizeData = JSON.parse(bodyStr);

        sendResponse(response, 200);

        console.log('[info] [webhook] success\n' + JSON.stringify({
          clientToken,
          nonce: requestNonce,
          body: tokenizeData,
        }, null, 2));
      });
    },
  },
};

const port = 3000;

http.createServer((request, response) => {
  const method = request.method;
  const route = request.url;

  if (!routes[route] || !routes[route][method]) {
    sendResponse(response, 404);
    return;
  }

  console.log('[info] [server] received request ' + method + ':' + route);

  try {
    routes[route][method](request, response);
  } catch (error) {
    sendResponse(response, 500);
    console.error("[fatal] [server] " + error.message);
  }
}).listen(port);

console.log('[info] [server] listening on port ' + port);
