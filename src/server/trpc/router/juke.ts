import {
  SonosDevice,
  SonosDeviceDiscovery,
  SonosEvents,
} from "@svrooij/sonos/lib";
import { Track } from "@svrooij/sonos/lib/models";
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

type SonosEvent =
  | {
      type: "currentTrack";
      track: Track;
    }
  | { type: "" };

export const juke = router({
  sonosDevices: publicProcedure
    // .output(z.object({ device: Sonos }))
    .query(async () => {
      const discovery = new SonosDeviceDiscovery();
      const results = await discovery.Search(15);
      const speakers = results.map((speaker) => ({
        name: speaker.model ?? "Unknown",
        host: speaker.host,
        port: speaker.port,
      }));
      return speakers;
    }),
  onSonosEvent: publicProcedure
    .input(z.object({ host: z.string(), port: z.number() }))
    .subscription(({ input }) => {
      const speaker = new SonosDevice(input.host, input.port);
      return observable<SonosEvent>((emit) => {
        const onEvent = (data: SonosEvent) => {
          // emit data to client
          emit.next(data);
        };
        function onCurrentTrack(track: Track) {
          onEvent({ type: "currentTrack", track });
        }
        speaker.Events.on(SonosEvents.CurrentTrackMetadata, onCurrentTrack);
        return () => {
          speaker.Events.off(SonosEvents.CurrentTrackMetadata, onCurrentTrack);
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
