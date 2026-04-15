import { router } from "../trpc";
import { workspaceRouter } from "./workspace";
import { equipmentRouter } from "./equipment";
import { dashboardRouter } from "./dashboard";
import { activityRouter } from "./activity";
import { locationRouter } from "./location";
import { categoryRouter } from "./category";
import { checkEventRouter } from "./checkEvent";
import { damageRouter } from "./damage";
import { reportsRouter } from "./reports";
import { teamRouter } from "./team";
import { adminRouter } from "./admin";

export const appRouter = router({
  workspace: workspaceRouter,
  equipment: equipmentRouter,
  dashboard: dashboardRouter,
  activity: activityRouter,
  location: locationRouter,
  category: categoryRouter,
  checkEvent: checkEventRouter,
  damage: damageRouter,
  reports: reportsRouter,
  team: teamRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
