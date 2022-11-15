import { router } from "../trpc";
import { juke } from "./juke";

export const appRouter = router({
  juke,
});

// export type definition of API
export type AppRouter = typeof appRouter;
