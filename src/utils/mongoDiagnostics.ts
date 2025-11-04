import dns from 'dns';
import net from 'net';
import tls from 'tls';
import mongoose from 'mongoose';

const { resolveSrv } = dns.promises;

function timeoutPromise<T>(ms: number, promise: Promise<T>, onTimeout?: () => void) {
  let timer: NodeJS.Timeout | null = null;
  const wrapped = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      if (onTimeout) onTimeout();
      reject(new Error('timeout'));
    }, ms);
    promise.then((v) => {
      if (timer) clearTimeout(timer);
      resolve(v);
    }, (e) => {
      if (timer) clearTimeout(timer);
      reject(e);
    });
  });
  return wrapped;
}

export async function runMongoDiagnostics(uri: string) {
  const result: any = { uriRedacted: uri ? uri.replace(/:\/\/.+?:.+?@/, '://<redacted>:<redacted>@') : null };
  if (!uri) {
    result.error = 'MONGODB_URI not provided';
    return result;
  }

  try {
    // SRV resolution (for mongodb+srv URIs)
    if (uri.startsWith('mongodb+srv://')) {
      try {
        const host = uri.replace(/^mongodb\+srv:\/\//, '').split('/')[0];
        result.srvTarget = host;
        const srv = await timeoutPromise(5000, resolveSrv(`_mongodb._tcp.${host}`));
        result.srvRecords = srv.map((r) => ({ name: r.name, port: r.port, priority: r.priority, weight: r.weight }));
      } catch (err) {
        result.srvError = String(err && (err as Error).message ? (err as Error).message : err);
      }
    }

    // TCP connect tests for each host (either from SRV or extract hosts from non-srv URI)
    const hosts: Array<{ host: string; port: number }> = [];
    if (result.srvRecords && result.srvRecords.length) {
      for (const r of result.srvRecords) hosts.push({ host: r.name, port: r.port || 27017 });
    } else {
      // parse hosts from mongodb:// or mongodb+srv fallback
      const m = uri.replace(/^mongodb(?:\+srv)?:\/\//, '').split('/')[0];
      const parts = m.split(',');
      for (const p of parts) {
        const [hostPart] = p.split(':');
        // if port provided use it otherwise default 27017 (note: SRV uses 27017 by default)
        const portMatch = p.match(/:(\d+)$/);
        const port = portMatch ? parseInt(portMatch[1], 10) : 27017;
        hosts.push({ host: hostPart, port });
      }
    }

    result.tcp = [];
    for (const h of hosts) {
      const r: any = { host: h.host, port: h.port };
      try {
        const tcpRes = await new Promise((resolve, reject) => {
          const socket = net.connect({ host: h.host, port: h.port }, () => {
            socket.end();
            resolve({ ok: true });
          });
          socket.on('error', (err) => {
            reject(err);
          });
          // timeout
          socket.setTimeout(5000, () => {
            socket.destroy();
            reject(new Error('tcp timeout'));
          });
        });
        r.result = tcpRes;
      } catch (err) {
        r.error = String(err && (err as Error).message ? (err as Error).message : err);
      }
      // TLS handshake attempt
      try {
        const tlsRes = await new Promise((resolve, reject) => {
          const t = tls.connect({ host: h.host, port: h.port, servername: h.host, rejectUnauthorized: false, timeout: 5000 }, () => {
            t.end();
            resolve({ ok: true });
          });
          t.on('error', (err) => reject(err));
          t.setTimeout(5000, () => {
            t.destroy();
            reject(new Error('tls timeout'));
          });
        });
        r.tls = tlsRes;
      } catch (err) {
        r.tlsError = String(err && (err as Error).message ? (err as Error).message : err);
      }
      result.tcp.push(r);
    }

    // Attempt a short mongoose connection using a separate connection so we don't affect app global state
    try {
      const conn = mongoose.createConnection();
      // use short timeouts so we fail fast
      const opts: any = { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 };
      // If URI is SRV, mongoose will manage TLS itself; no need to set tls explicitly here
      const connected = await timeoutPromise(10000, new Promise((resolve, reject) => {
        conn.openUri(uri, opts).then(() => resolve({ ok: true })).catch(reject);
      }), () => {
        try { conn.close(); } catch (e) {}
      });
      result.mongoose = connected;
      try { await conn.close(); } catch (e) {}
    } catch (err) {
      result.mongooseError = String(err && (err as Error).stack ? (err as Error).stack : err);
    }
  } catch (err) {
    result.unexpected = String(err && (err as Error).stack ? (err as Error).stack : err);
  }

  return result;
}

export default runMongoDiagnostics;
