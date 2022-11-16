/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import fetch from "node-fetch";
import ws from "ws";

dotenv.config({ path: ".env.local" });

import { createContext } from "./context";
import { appRouter } from "./router/_app";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (!global.fetch) {
  (global as any).fetch = fetch;
}
const wss = new ws.Server({
  port: 3002,
});
const handler = applyWSSHandler({ wss, router: appRouter, createContext });

wss.on("connection", (ws) => {
  console.log(`➕➕ Connection (${wss.clients.size})`);
  ws.once("close", () => {
    console.log(`➖➖ Connection (${wss.clients.size})`);
  });
});
console.log("✅ WebSocket Server listening on ws://localhost:3002");

process.on("SIGTERM", () => {
  console.log("SIGTERM");
  handler.broadcastReconnectNotification();
  wss.close();
});
