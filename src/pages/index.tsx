import { Popover } from "@headlessui/react";
import * as Slider from "@radix-ui/react-slider";
import type { inferProcedureOutput } from "@trpc/server";
import classNames from "classnames";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import {
  AudioPlayerProvider,
  useAudioPlayer,
  useAudioPosition,
} from "react-use-audio-player";
import { useDebounce } from "usehooks-ts";

import SelectSonos from "../components/SelectSonos";
import type { AppRouter } from "../server/trpc/router/_app";
import { trpc } from "../utils/trpc";

type Album = inferProcedureOutput<AppRouter["juke"]["albums"]>[0];
type Track = inferProcedureOutput<AppRouter["juke"]["tracks"]>[0];
type Speaker = inferProcedureOutput<AppRouter["juke"]["sonosDevices"]>[0];

const URLBASE = process.env.NEXT_PUBLIC_URLBASE ?? "";

type NonEmptyArr<T> = [T, ...T[]];

function useBrowserPlayer(tracks: NonEmptyArr<Track>) {
  const [index, setIndex] = useState(0);
  const path = tracks[index]?.path;

  const { position, duration, seek } = useAudioPosition({
    highRefreshRate: false,
  });

  const { togglePlayPause, playing } = useAudioPlayer({
    src: path ? `${URLBASE}${path}` : undefined,
    format: "mp3",
    autoplay: true,
    html5: true,
    onend: () => {
      setIndex((previous) => previous + 1);
    },
  });

  useEffect(() => {
    return () => {
      // Stop playback on unmount
      if (playing) {
        togglePlayPause();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [togglePlayPause]);

  return {
    index,
    setIndex,
    position,
    duration,
    seek,
    togglePlayPause,
    playing,
  };
}

function useSonosPlayer(
  speaker: Speaker,
  tracks: NonEmptyArr<Track>
): ReturnType<typeof useBrowserPlayer> {
  const queueAlbum = trpc.juke.sonosQueueAlbum.useMutation();
  const pause = trpc.juke.sonosPause.useMutation();
  const play = trpc.juke.sonosPlay.useMutation();
  const seek = trpc.juke.sonosSeek.useMutation();

  trpc.juke.onSonosEvent.useSubscription(speaker, {
    onData: (event) => {
      if (event.type === "currentTrack") {
        // Potentially queue next track
      }
      if (event.type === "stopped") {
        if (playing) {
          setIndex((previous) => {
            const next = tracks[previous + 1];
            if (next) {
              return previous + 1;
            } else {
              setPlaying(false);
              return previous;
            }
          });
        }
      }
    },
  });

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    function tick() {
      if (playing) {
        setPosition((previous) => previous + 1);
      }
    }
    const timeout = setTimeout(tick, 1000);
    return () => {
      clearTimeout(timeout);
    };
  });

  const track = tracks[index] ?? tracks[0];

  useEffect(() => {
    void queueAlbum.mutateAsync({ ...speaker, trackId: track.id }).then(() => {
      void play.mutateAsync({ ...speaker }).then(() => {
        setPlaying(true);
        setPosition(0);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  function togglePlayPause() {
    if (playing) {
      setPlaying(false);
      void pause.mutateAsync({ ...speaker });
    } else {
      setPlaying(true);
      void play.mutateAsync({ ...speaker });
    }
  }

  return {
    index,
    setIndex,
    position,
    duration: track.duration,
    seek: (position) => {
      void seek.mutateAsync({ ...speaker, position }).then(() => {
        setPosition(() => {
          return position;
        });
      });
      return position;
    },
    togglePlayPause,
    playing,
  };
}

function SonosPlayer({
  speaker,
  album,
  tracks,
}: {
  speaker: Speaker;
  album: Album;
  tracks: NonEmptyArr<Track>;
}) {
  const player = useSonosPlayer(speaker, tracks);
  return <Player {...player} album={album} tracks={tracks} />;
}

function BrowserPlayer({
  album,
  tracks,
}: {
  album: Album;
  tracks: NonEmptyArr<Track>;
}) {
  const player = useBrowserPlayer(tracks);
  return <Player {...player} album={album} tracks={tracks} />;
}

function Player({
  tracks,
  album,
  index,
  setIndex,
  position,
  duration,
  seek,
  togglePlayPause,
  playing,
}: ReturnType<typeof useBrowserPlayer> & {
  album: Album;
  tracks: NonEmptyArr<Track>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="font-mono text-xs">
        <p className="mb-3">
          {album.artist} / {album.name}
        </p>
        <ol className="hide-scrollbar flex max-h-64 flex-col items-start gap-0.5 overflow-y-auto">
          {tracks.map((track, i) => (
            <li
              className={`w-full ${i === index ? "text-white" : ""}`}
              key={track.id}
            >
              <button
                className="w-full truncate text-left hover:underline"
                onClick={() => {
                  setIndex(i);
                }}
              >
                {i === index ? "▶ ." : String(i + 1).padStart(2, "0") + "."}{" "}
                {track.name}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <Slider.Root
        className="relative flex h-5 w-full touch-none items-center"
        value={[position]}
        onValueChange={(value) => {
          value.forEach((value) => seek(value));
        }}
        max={duration}
        step={1}
        aria-label="Volume"
      >
        <Slider.Track className="relative h-1 w-full grow rounded-full bg-white dark:bg-gray-800">
          <Slider.Range className="absolute h-full rounded-full bg-purple-600 dark:bg-white" />
        </Slider.Track>
        <Slider.Thumb
          className={classNames(
            "block h-3 w-3 rounded-full bg-purple-600 dark:bg-white",
            "focus:outline-none focus-visible:ring focus-visible:ring-purple-500 focus-visible:ring-opacity-75"
          )}
        />
      </Slider.Root>
      <div className="flex items-stretch justify-center gap-4 font-mono">
        {!!album.artpath && (
          //eslint-disable-next-line @next/next/no-img-element
          <img
            alt="Album cover"
            className="aspect-square h-10 rounded"
            src={`${URLBASE}${album.artpath}`}
          />
        )}
        <button
          onClick={() => {
            togglePlayPause();
          }}
          type="button"
          className="flex h-10 w-full items-center justify-center rounded-md border-gray-300 bg-neutral-700 px-4 py-2 text-neutral-200 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
        >
          {playing ? "Pause" : "Play"}
        </button>
      </div>
    </div>
  );
}

function useCurrentAlbumId() {
  const router = useRouter();
  return new URL(router.asPath, "https://localhost").searchParams.get("album");
}

function Albums({ albums }: { albums: Album[] }) {
  const currentAlbumId = useCurrentAlbumId();
  const router = useRouter();
  return (
    <div className="mb-[50vh] grid grid-cols-[repeat(auto-fill,minmax(min(10rem,100%),1fr))]">
      {albums.map((album) => (
        <button
          onClick={(event) => {
            event.detail === 2
              ? void router.push(`/?album=${album.id}`, undefined, {
                  shallow: true,
                })
              : null;
          }}
          key={album.id}
          className="relative aspect-square"
        >
          {album.id.toString() === currentAlbumId ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-3xl text-white">
              <span className="animate-pulse">▶</span>
            </div>
          ) : null}
          {album.artpath.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              loading="lazy"
              src={`${URLBASE}${album.artpath}`}
              className="w-fill aspect-square h-full object-cover"
              alt={`Cover of ${album.name ?? "unknown"}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-around bg-neutral-400 p-2 text-center text-sm">
              <div>
                <div className="font-bold">{album.artist}</div>
                {album.name}
              </div>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

export default function Page() {
  const ref = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query.trim(), 480);
  const albumsQuery = trpc.juke.albums.useQuery(
    { query: debouncedQuery },
    { cacheTime: Infinity }
  );
  const devicesQuery = trpc.juke.sonosDevices.useQuery(undefined, {
    cacheTime: 60,
  });

  const albums = albumsQuery.data ?? [];
  const currentAlbumId = useCurrentAlbumId();
  const currentAlbum = albums.find(
    ({ id }) => id.toString() === currentAlbumId
  );

  const itemsQuery = trpc.juke.tracks.useQuery(
    { id: currentAlbum?.id ?? 0 },
    { cacheTime: Infinity, enabled: !!currentAlbum }
  );

  const tracks =
    itemsQuery.data && itemsQuery.data.length > 0
      ? (itemsQuery.data as NonEmptyArr<Track>)
      : null;

  useEffect(() => {
    function callback(event: KeyboardEvent) {
      if (event.key === "k" && event.metaKey && ref.current) {
        window.scrollTo({ top: 0 });
        ref.current.focus();
        ref.current.setSelectionRange(0, ref.current.value.length);
      }
    }
    document.addEventListener("keydown", callback);
    return () => {
      document.removeEventListener("keydown", callback);
    };
  });

  const [speaker, setSpeaker] = useState<Speaker | null>(null);

  return (
    <>
      <Head>
        <title>Juke</title>
        <meta name="description" content="juke" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <AudioPlayerProvider>
        <Popover>
          {() => (
            <Popover.Panel static>
              {currentAlbum && tracks ? (
                <div className="fixed bottom-6 right-6 z-20 max-w-xs transform overflow-hidden rounded-2xl bg-black/70 p-4 text-left align-middle text-neutral-500 drop-shadow-xl backdrop-blur-xl transition-all">
                  {speaker ? (
                    <SonosPlayer
                      speaker={speaker}
                      album={currentAlbum}
                      tracks={tracks}
                      key={currentAlbumId}
                    />
                  ) : (
                    <BrowserPlayer
                      album={currentAlbum}
                      tracks={tracks}
                      key={currentAlbumId}
                    />
                  )}
                </div>
              ) : null}
            </Popover.Panel>
          )}
        </Popover>
      </AudioPlayerProvider>

      <Popover>
        {() => (
          <Popover.Panel static>
            {devicesQuery.data ? (
              <div className="fixed bottom-6 left-6 z-20 max-w-xs transform rounded-2xl bg-black/70 p-4 text-left align-middle text-neutral-500 drop-shadow-xl backdrop-blur-xl transition-all">
                <SelectSonos
                  options={devicesQuery.data}
                  selected={speaker}
                  setSelected={setSpeaker}
                />
              </div>
            ) : null}
          </Popover.Panel>
        )}
      </Popover>

      <main className="flex h-screen flex-col gap-2 bg-neutral-200 p-2">
        <div className="w-full">
          <input
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
            type="search"
            autoFocus
            ref={ref}
            placeholder="Search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </div>
        <div className="relative flex w-full grow justify-center">
          <div className="absolute inset-0 overflow-hidden rounded-md bg-neutral-900">
            <div className="h-full w-full overflow-y-auto">
              <Albums albums={albums} />
            </div>
          </div>
          {/* <div className="h-full w-full rounded-md bg-neutral-800">
          </div> */}
        </div>
      </main>
    </>
  );
}
