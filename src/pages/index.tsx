import Head from "next/head";

import { trpc } from "../utils/trpc";

import { Popover } from "@headlessui/react";
import * as Slider from "@radix-ui/react-slider";
import type { inferProcedureOutput } from "@trpc/server";
import classNames from "classnames";
import Fuse from "fuse.js";
import { useEffect, useState } from "react";
import {
  AudioPlayerProvider,
  useAudioPlayer,
  useAudioPosition,
} from "react-use-audio-player";
import type { AppRouter } from "../server/trpc/router/_app";

type Album = inferProcedureOutput<AppRouter["juke"]["albums"]>[0];

function useDebounce<T>(value: T, delay?: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay || 500);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

const URLBASE = process.env.NEXT_PUBLIC_URLBASE ?? "";

function Player({ album }: { album: Album }) {
  const itemsQuery = trpc.juke.tracks.useQuery(
    { id: album.id },
    { cacheTime: Infinity }
  );
  const [index, setIndex] = useState(0);

  const list = itemsQuery.data ?? [
    { path: album.firstTrackPath, name: null, id: 0 },
  ];
  const path = list[index]?.path;

  const { position, duration, seek } = useAudioPosition({
    highRefreshRate: true,
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

  return (
    <div className="flex flex-col gap-4">
      <Slider.Root
        className="relative flex h-5 w-full touch-none items-center"
        value={[position]}
        onValueChange={(value) => value.forEach((value) => seek(value))}
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
      <ol className="hide-scrollbar flex max-h-64 flex-col items-start gap-0.5 overflow-y-auto">
        {list.map((track, i) => (
          <li
            className={`w-full font-mono text-xs ${
              i === index ? "text-white" : ""
            }`}
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
      <div className="flex justify-center gap-4 font-mono">
        <button
          onClick={() => {
            togglePlayPause();
          }}
          type="button"
          className="block w-full rounded-md border-gray-300 bg-neutral-700 px-4 py-2 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
        >
          {playing ? "Pause" : "Play"}
        </button>
      </div>
    </div>
  );
}

export default function Page() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query.trim(), 380);
  const albumsQuery = trpc.juke.albums.useQuery();

  const [current, setCurrent] = useState<Album | null>(null);

  const albums = albumsQuery?.data ?? [];

  const filteredAlbums = debouncedQuery
    ? new Fuse(albums, {
        keys: ["name", "artist"],
        findAllMatches: true,
        includeScore: true,
        minMatchCharLength: 3,
      })
        .search(query)
        .map(({ item }) => item)
    : albums;

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
              {current ? (
                <div className="fixed bottom-6 right-6 z-20 max-w-xs transform overflow-hidden rounded-2xl bg-black/70 p-4 text-left align-middle text-neutral-500 drop-shadow-xl backdrop-blur-xl transition-all">
                  <Player album={current} key={current.id} />
                </div>
              ) : null}
            </Popover.Panel>
          )}
        </Popover>
      </AudioPlayerProvider>

      <main className="flex min-h-screen flex-col gap-2 bg-neutral-200 p-2">
        <div className="w-full">
          <input
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
            type="search"
            autoFocus
            placeholder="Search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value ?? "");
            }}
          />
        </div>
        <div className="flex w-full grow justify-center">
          <div className="w-full overflow-hidden rounded-md bg-neutral-800">
            {filteredAlbums ? (
              <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(min(10rem,100%),1fr))] justify-start">
                {filteredAlbums.map((album) => (
                  <button
                    onClick={(event) => {
                      event.detail === 2 ? setCurrent(album) : null;
                    }}
                    key={album.id}
                    className="relative"
                  >
                    {album.id === current?.id ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-3xl text-white">
                        <span className="animate-pulse">▶</span>
                      </div>
                    ) : null}
                    {album.artpath.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        loading="lazy"
                        src={`${URLBASE}${album.artpath}`}
                        className="aspect-square h-full w-full object-cover"
                        alt={`Cover of ${album.name}`}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-around bg-neutral-400 p-2 text-center text-sm">
                        <div>
                          <div className="font-bold">{album.artist}</div>
                          {album.name}
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p>Loading..</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
