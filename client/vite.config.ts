import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { generate } from "selfsigned";

const root = path.dirname(fileURLToPath(import.meta.url));

function lanIps() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((n): n is os.NetworkInterfaceInfo => Boolean(n && (n.family === "IPv4" || n.family === 4) && !n.internal))
    .map((n) => n.address);
}

async function devHttps() {
  const dir = path.join(root, ".dev-certs");
  const keyPath = path.join(dir, "key.pem");
  const certPath = path.join(dir, "cert.pem");
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  }
  const ips = lanIps();
  const pems = await generate([{ name: "commonName", value: "Kumite Arena" }], {
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: "localhost" },
          { type: 7, ip: "127.0.0.1" },
          ...ips.map((ip) => ({ type: 7 as const, ip })),
        ],
      },
    ],
  });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  return { key: pems.private, cert: pems.cert };
}

export default defineConfig(async ({ command, isPreview }) => ({
  plugins: [react()],
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 4173,
    allowedHosts: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    https: command === "serve" && !isPreview ? await devHttps() : undefined,
    allowedHosts: true,
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
      "/uploads": { target: "http://localhost:5000", changeOrigin: true },
      "/socket.io": { target: "http://localhost:5000", ws: true },
    },
  },
}));
