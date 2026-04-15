import { router } from "../trpc";
import { locationRouter } from "./location";

export const adminRouter = router({
  location: locationRouter,
});
