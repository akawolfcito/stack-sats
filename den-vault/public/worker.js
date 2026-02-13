// optional: use the worker.js script to handle heavy computations using Worker API

self.onmessage = async function (message) {
  self.postMessage("Worker thread is working...");
};
