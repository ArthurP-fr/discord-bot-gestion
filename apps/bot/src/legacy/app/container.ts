import type {
  MemberMessageService,
} from "../modules/memberMessages/index.js";
import type {
  LogEventService,
} from "../modules/logs/index.js";
import type {
  PresenceService,
} from "../modules/presence/index.js";

export interface AppFeatureServices {
  presenceService: PresenceService;
  memberMessageService: MemberMessageService;
  logEventService: LogEventService;
}
