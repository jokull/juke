import {
  SonosDevice,
  SonosDeviceDiscovery,
  SonosEvents,
} from "@svrooij/sonos/lib";
import { Track } from "@svrooij/sonos/lib/models";
import DeviceDescription from "@svrooij/sonos/lib/models/device-description";
import { observable } from "@trpc/server/observable";
import Fuse from "fuse.js";
import { z } from "zod";

import { publicProcedure, router } from "../trpc";

const decoder = new TextDecoder("utf-8");

function getRelativePath(path: Buffer | null) {
  return decoder
    .decode(path ?? undefined)
    .split("/")
    .slice(5)
    .map((component) => encodeURIComponent(component))
    .join("/");
}

export type SonosEvent =
  | {
      type: "currentTrack";
      track: Track;
    }
  | { type: "volume"; number: number }
  | { type: "connected"; device: DeviceDescription };

export const juke = router({
  sonosDevices: publicProcedure
    // .output(z.object({ device: Sonos }))
    .query(async () => {
      const discovery = new SonosDeviceDiscovery();
      const results = await discovery.Search(3);
      return Promise.all(
        results.map(async (speaker) => ({
          name: (
            await new SonosDevice(
              speaker.host,
              speaker.port
            ).GetDeviceDescription()
          ).roomName,
          host: speaker.host,
          port: speaker.port,
        }))
      );
    }),
  onSonosEvent: publicProcedure
    .input(z.object({ host: z.string(), port: z.number() }))
    .subscription(async ({ input }) => {
      const speaker = new SonosDevice(input.host, input.port);
      console.log({ speaker });
      const queue = await speaker.QueueService.CreateQueue({
        QueueOwnerID: "bobby",
        QueueOwnerContext: "sonos",
        QueuePolicy: "",
      });
      console.log({ queue });
      const device = await speaker.GetDeviceDescription();

      return observable<SonosEvent>((emit) => {
        emit.next({ type: "connected", device });
        const onEvent = (data: SonosEvent) => {
          // emit data to client
          console.log("event", { data });
          emit.next(data);
        };
        function onCurrentTrack(track: Track) {
          onEvent({ type: "currentTrack", track });
        }
        function onVolume(number: number) {
          onEvent({ type: "volume", number });
        }
        // function onControl(event: RenderingControlServiceEvent) {
        //   onEvent({ type: "control", event });
        // }
        speaker.Events.on(SonosEvents.CurrentTrackMetadata, onCurrentTrack);
        speaker.Events.on(SonosEvents.Volume, onVolume);
        // speaker.Events.on(SonosEvents.RenderingControl, onControl);
        return () => {
          speaker.CancelEvents();
          // speaker.Events.off(SonosEvents.CurrentTrackMetadata, onCurrentTrack);
          // speaker.Events.off(SonosEvents.Volume, onVolume);
          // speaker.Events.off(SonosEvents.RenderingControl, onControl);
        };
      });
    }),
  tracks: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const items = await ctx.prisma.items.findMany({
        where: { album_id: input.id },
        orderBy: { track: "asc" },
      });
      return items.map((item) => ({
        id: item.id,
        path: getRelativePath(item.path),
        name: item.title,
      }));
    }),
  albums: publicProcedure
    .input(z.object({ query: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      const data = await ctx.prisma.albums.findMany({
        orderBy: { original_year: "desc" },
        include: {
          items: { take: 1, orderBy: { track: "asc" }, select: { path: true } },
        },
      });
      const albums = data.map((album) => ({
        id: album.id,
        artpath: getRelativePath(album.artpath),
        name: album.album,
        artist: album.albumartist,
        firstTrackPath: getRelativePath(
          album.items.find(({ path }) => path)?.path ?? null
        ),
      }));
      return input.query && input.query.trim().length > 0
        ? new Fuse(albums, {
            keys: ["name", "artist"],
            findAllMatches: true,
            includeScore: true,
            minMatchCharLength: 3,
          })
            .search(input.query.trim())
            .map(({ item }) => item)
        : albums;
    }),
});
