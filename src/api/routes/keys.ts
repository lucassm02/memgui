import { Router } from "express";
import { checkConnectionMiddleware } from "../middlewares";
import { makeKeyController } from "@/api/controllers";
import { validationAdapter } from "@/api/utils";
import { cacheValueSchema, cacheKeySchema } from "@/api/utils/validationSchema";

const keyController = makeKeyController();

const route = Router();

route.use(checkConnectionMiddleware);

route.post(
  "/keys",
  validationAdapter(cacheValueSchema),
  keyController.create.bind(keyController)
);
route.get("/keys", keyController.getAll.bind(keyController));
route.delete("/keys", keyController.flushAll.bind(keyController));

route.get(
  "/keys/:key",
  validationAdapter(cacheKeySchema),
  keyController.getByName.bind(keyController)
);

route.delete(
  "/keys/:key",
  validationAdapter(cacheKeySchema),
  keyController.deleteByName.bind(keyController)
);

export default route;
