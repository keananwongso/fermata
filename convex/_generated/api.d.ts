/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as ask from "../ask.js";
import type * as askData from "../askData.js";
import type * as codeLearner from "../codeLearner.js";
import type * as engine from "../engine.js";
import type * as evaluation from "../evaluation.js";
import type * as humans from "../humans.js";
import type * as learner from "../learner.js";
import type * as lib_ask from "../lib/ask.js";
import type * as lib_askPresets from "../lib/askPresets.js";
import type * as lib_console from "../lib/console.js";
import type * as lib_domain from "../lib/domain.js";
import type * as lib_engineCore from "../lib/engineCore.js";
import type * as lib_format from "../lib/format.js";
import type * as lib_generate from "../lib/generate.js";
import type * as lib_investigate from "../lib/investigate.js";
import type * as lib_learn from "../lib/learn.js";
import type * as lib_rules from "../lib/rules.js";
import type * as lib_transition from "../lib/transition.js";
import type * as lib_voiceMatch from "../lib/voiceMatch.js";
import type * as lib_world from "../lib/world.js";
import type * as queries from "../queries.js";
import type * as roomAgents from "../roomAgents.js";
import type * as rooms from "../rooms.js";
import type * as run from "../run.js";
import type * as scenario from "../scenario.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  ask: typeof ask;
  askData: typeof askData;
  codeLearner: typeof codeLearner;
  engine: typeof engine;
  evaluation: typeof evaluation;
  humans: typeof humans;
  learner: typeof learner;
  "lib/ask": typeof lib_ask;
  "lib/askPresets": typeof lib_askPresets;
  "lib/console": typeof lib_console;
  "lib/domain": typeof lib_domain;
  "lib/engineCore": typeof lib_engineCore;
  "lib/format": typeof lib_format;
  "lib/generate": typeof lib_generate;
  "lib/investigate": typeof lib_investigate;
  "lib/learn": typeof lib_learn;
  "lib/rules": typeof lib_rules;
  "lib/transition": typeof lib_transition;
  "lib/voiceMatch": typeof lib_voiceMatch;
  "lib/world": typeof lib_world;
  queries: typeof queries;
  roomAgents: typeof roomAgents;
  rooms: typeof rooms;
  run: typeof run;
  scenario: typeof scenario;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
