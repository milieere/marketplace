import { z } from "zod";

export const HealthResponse = z.object({
  status: z.literal("ok"),
  mock: z.boolean(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
