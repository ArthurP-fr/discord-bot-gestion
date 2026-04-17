import { bootstrap } from "./app/bootstrap.js";
import { createScopedLogger } from "./core/logging/logger.js";

const log = createScopedLogger("boot");

bootstrap().catch((error) => {
  log.fatal({ err: error }, "fatal startup error");
  process.exit(1);
});
