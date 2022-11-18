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

const URLBASE = process.env.NEXT_PUBLIC_URLBASE ?? "";

function getRelativePath(path: Buffer | null, encode: boolean) {
  return decoder
    .decode(path ?? undefined)
    .split("/")
    .slice(5)
    .map((component) => (encode ? encodeURIComponent(component) : component))
    .join("/");
}

export type SonosEvent =
  | {
      type: "currentTrack";
      track: Track;
    }
  | {
      type: "nextTrack";
      track: Track;
    }
  | { type: "volume"; number: number }
  | { type: "connected"; device: DeviceDescription }
  | { type: "stopped" };

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
  sonosQueueAlbum: publicProcedure
    .input(
      z.object({ trackId: z.number(), host: z.string(), port: z.number() })
    )
    .mutation(async ({ input, ctx }) => {
      const track = await ctx.prisma.items.findUniqueOrThrow({
        where: { id: input.trackId },
        include: { Album: {} },
      });
      const speaker = new SonosDevice(input.host, input.port);
      return speaker.AVTransportService.SetAVTransportURI({
        InstanceID: 0,
        CurrentURI: `${URLBASE}${getRelativePath(track.path, false)}`,
        CurrentURIMetaData: {
          Album: track.Album?.album ?? "Unknown",
          Artist: track.artist ?? "Unknown",
          Title: track.title ?? "Unknown",
          AlbumArtUri: track.Album
            ? `${URLBASE}/${getRelativePath(track.Album.artpath, true)}`
            : undefined,
          TrackUri: `${URLBASE}${getRelativePath(track.path, false)}`,
          ProtocolInfo: "http-get:*:audio/mpeg:*",
          UpnpClass: "object.item.audioItem.musicTrack",
        },
      });
    }),
  sonosPlay: publicProcedure
    .input(z.object({ host: z.string(), port: z.number() }))
    .mutation(async ({ input }) => {
      const speaker = new SonosDevice(input.host, input.port);
      return speaker.Play();
    }),
  sonosPause: publicProcedure
    .input(z.object({ host: z.string(), port: z.number() }))
    .mutation(async ({ input }) => {
      const speaker = new SonosDevice(input.host, input.port);
      return speaker.Pause();
    }),
  sonosSeek: publicProcedure
    .input(
      z.object({ host: z.string(), port: z.number(), position: z.number() })
    )
    .mutation(async ({ input }) => {
      const speaker = new SonosDevice(input.host, input.port);
      return speaker.SeekPosition(
        new Date(input.position * 1000).toISOString().slice(11, 11 + 8)
      );
    }),
  onSonosEvent: publicProcedure
    .input(z.object({ host: z.string(), port: z.number() }))
    .subscription(async ({ input }) => {
      const speaker = new SonosDevice(input.host, input.port);
      const device = await speaker.GetDeviceDescription();

      return observable<SonosEvent>((emit) => {
        emit.next({ type: "connected", device });
        const onEvent = (data: SonosEvent) => {
          emit.next(data);
        };
        function onCurrentTrack(track: Track) {
          onEvent({ type: "currentTrack", track });
        }
        function onVolume(number: number) {
          onEvent({ type: "volume", number });
        }
        function onStopped() {
          onEvent({ type: "stopped" });
        }
        function onNextTrack(track: Track) {
          onEvent({ type: "nextTrack", track });
        }
        speaker.Events.on(SonosEvents.CurrentTrackMetadata, onCurrentTrack);
        speaker.Events.on(SonosEvents.Volume, onVolume);
        speaker.Events.on(SonosEvents.PlaybackStopped, onStopped);
        speaker.Events.on(SonosEvents.NextTrackMetadata, onNextTrack);
        return () => {
          speaker.CancelEvents();
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
        path: getRelativePath(item.path, true),
        name: item.title,
        duration: item.length ?? 0,
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
        artpath: getRelativePath(album.artpath, true),
        name: album.album,
        artist: album.albumartist,
        firstTrackPath: getRelativePath(
          album.items.find(({ path }) => path)?.path ?? null,
          true
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
