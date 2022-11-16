import type { NextRequest } from "next/server";
import { AsyncDeviceDiscovery } from "sonos";

export const config = {
  runtime: "experimental-edge",
};

// const writableStream = new WritableStream({
//   start(controller) {
//     console.log("[start]");
//   },
//   async write(chunk, controller) {
//     console.log("[write]", chunk);
//     // Wait for next write.
//     await new Promise((resolve) =>
//       setTimeout(() => {
//         document.body.textContent += chunk;
//         resolve(undefined);
//       }, 1_000)
//     );
//   },
//   close(controller) {
//     console.log("[close]");
//   },
//   abort(reason) {
//     console.log("[abort]", reason);
//   },
// });

// const writer = writableStream.getWriter();

// const start = Date.now();
// for (const char of 'abcdefghijklmnopqrstuvwxyz') {
//   // Wait to add to the write queue.
//   await writer.ready;
//   console.log('[ready]', Date.now() - start, 'ms');
//   // The Promise is resolved after the write finishes.
//   writer.write(char);
// }

const devices: [] = [];

const discovery = new AsyncDeviceDiscovery();
discovery.discover().then(async (device, model) => {
  // Do stuff, see examples/devicediscovery.js
  // await writer.ready;
  // void writer.write(JSON.stringify(device) + '\n\n')
  devices.push(device);
});

export default async function handler(req: NextRequest) {
  // const reader = writer.

  // const response = new ReadableStream({
  //   async start(controller) {
  //     while (true) {
  //       const { done, value } = await reader.read()

  //       // When no more data needs to be consumed, break the reading
  //       if (done) {
  //         break
  //       }

  //       // Enqueue the next data chunk into our target stream
  //       controller.enqueue(value)
  //     }

  //     // Close the stream
  //     controller.close()
  //     reader.releaseLock()
  //   },
  // })

  return new Response(
    JSON.stringify({ devices }),
    { status: 200, headers: { "content-type": "application/json" } }
    // response,
    // {
    //   status: 200,
    //   headers: {
    //     "Content-Type": "text/event-stream",
    //     Connection: "keep-alive",
    //     "Cache-Control": "no-cache",
    //   },
    // }
  );
}
