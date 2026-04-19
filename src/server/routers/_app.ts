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
import { billingRouter } from "./billing";
import { userRouter } from "./user";
import { projectRouter } from "./project";
import { productRouter } from "./product";
import { labelsRouter } from "./labels";

export const appRouter = router({
  user: userRouter,
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
  billing: billingRouter,
  project: projectRouter,
  product: productRouter,
  labels: labelsRouter,
});

export type AppRouter = typeof appRouter;
