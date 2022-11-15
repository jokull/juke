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

export const juke = router({
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
  albums: publicProcedure.query(async ({ ctx }) => {
    const albums = await ctx.prisma.albums.findMany({
      orderBy: { original_year: "desc" },
      include: {
        items: { take: 1, orderBy: { track: "asc" }, select: { path: true } },
      },
    });
    return albums.map((album) => ({
      id: album.id,
      artpath: getRelativePath(album.artpath),
      name: album.album,
      artist: album.albumartist,
      firstTrackPath: getRelativePath(
        album.items.find(({ path }) => path)?.path ?? null
      ),
    }));
  }),
});
