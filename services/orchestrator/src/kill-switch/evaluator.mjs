/**
 * Phase 1 Kill-Switch Controls V1.
 *
 * This module is a static deny-only safety boundary. It does not authorize,
 * approve, dispatch, execute, persist, or contact an external system.
 */

const freeze = Object.freeze;
const hasOwn = Object.hasOwn;

function deepFreeze(value) {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return freeze(value);
}

// Private, repository-committed V1 authority. It is intentionally not exported.
const authority = deepFreeze({
  schemaVersion: "1.0.0",
  authorityId: "sut-aios-kill-switch-controls",
  mode: "observe-only",
  productionWritePermission: false,
  controls: [
    {
      controlId: "global-autonomous-actions",
      scope: "global",
      targetAction: "autonomous_action",
      engaged: true,
      reasonCode: "KILL_SWITCH_GLOBAL_AUTONOMY_ENGAGED"
    },
    {
      controlId: "playbook-content-schema-repair-shadow",
      scope: "playbook",
      targetAction: "playbook_dispatch",
      targetId: "content-schema-repair-shadow",
      engaged: true,
      reasonCode: "KILL_SWITCH_PLAYBOOK_ENGAGED"
    },
    {
      controlId: "executor-codex-content-executor",
      scope: "executor",
      targetAction: "executor_dispatch",
      targetId: "codex-content-executor",
      engaged: true,
      reasonCode: "KILL_SWITCH_EXECUTOR_ENGAGED"
    },
    {
      controlId: "codex-dispatch",
      scope: "dispatch",
      targetAction: "codex_dispatch",
      engaged: true,
      reasonCode: "KILL_SWITCH_CODEX_DISPATCH_PAUSED"
    },
    {
      controlId: "pending-actions",
      scope: "workflow",
      targetAction: "pending_action",
      engaged: true,
      reasonCode: "KILL_SWITCH_PENDING_ACTION_REJECTED"
    },
    {
      controlId: "outbound-notifications",
      scope: "notification",
      targetAction: "outbound_notification",
      engaged: true,
      reasonCode: "KILL_SWITCH_OUTBOUND_NOTIFICATIONS_PAUSED"
    }
  ]
});

const actionValues = freeze([
  "autonomous_action",
  "playbook_dispatch",
  "executor_dispatch",
  "codex_dispatch",
  "pending_action",
  "outbound_notification",
  "observe"
]);
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function exactKeys(value, expected) {
  const actual = Object.keys(value);
  return actual.length === expected.length && expected.every((key, index) => actual[index] === key);
}

function controlIsValid(control, expectedKeys, expectedValues) {
  return Object.isFrozen(control) &&
    exactKeys(control, expectedKeys) &&
    expectedKeys.every((key) => control[key] === expectedValues[key]);
}

function authorityIsValid() {
  try {
    if (!Object.isFrozen(authority) ||
        !exactKeys(authority, ["schemaVersion", "authorityId", "mode", "productionWritePermission", "controls"]) ||
        authority.schemaVersion !== "1.0.0" ||
        authority.authorityId !== "sut-aios-kill-switch-controls" ||
        authority.mode !== "observe-only" ||
        authority.productionWritePermission !== false ||
        !Array.isArray(authority.controls) ||
        !Object.isFrozen(authority.controls) ||
        authority.controls.length !== 6) {
      return false;
    }

    return controlIsValid(
      authority.controls[0],
      ["controlId", "scope", "targetAction", "engaged", "reasonCode"],
      { controlId: "global-autonomous-actions", scope: "global", targetAction: "autonomous_action", engaged: true, reasonCode: "KILL_SWITCH_GLOBAL_AUTONOMY_ENGAGED" }
    ) && controlIsValid(
      authority.controls[1],
      ["controlId", "scope", "targetAction", "targetId", "engaged", "reasonCode"],
      { controlId: "playbook-content-schema-repair-shadow", scope: "playbook", targetAction: "playbook_dispatch", targetId: "content-schema-repair-shadow", engaged: true, reasonCode: "KILL_SWITCH_PLAYBOOK_ENGAGED" }
    ) && controlIsValid(
      authority.controls[2],
      ["controlId", "scope", "targetAction", "targetId", "engaged", "reasonCode"],
      { controlId: "executor-codex-content-executor", scope: "executor", targetAction: "executor_dispatch", targetId: "codex-content-executor", engaged: true, reasonCode: "KILL_SWITCH_EXECUTOR_ENGAGED" }
    ) && controlIsValid(
      authority.controls[3],
      ["controlId", "scope", "targetAction", "engaged", "reasonCode"],
      { controlId: "codex-dispatch", scope: "dispatch", targetAction: "codex_dispatch", engaged: true, reasonCode: "KILL_SWITCH_CODEX_DISPATCH_PAUSED" }
    ) && controlIsValid(
      authority.controls[4],
      ["controlId", "scope", "targetAction", "engaged", "reasonCode"],
      { controlId: "pending-actions", scope: "workflow", targetAction: "pending_action", engaged: true, reasonCode: "KILL_SWITCH_PENDING_ACTION_REJECTED" }
    ) && controlIsValid(
      authority.controls[5],
      ["controlId", "scope", "targetAction", "engaged", "reasonCode"],
      { controlId: "outbound-notifications", scope: "notification", targetAction: "outbound_notification", engaged: true, reasonCode: "KILL_SWITCH_OUTBOUND_NOTIFICATIONS_PAUSED" }
    );
  } catch {
    return false;
  }
}

function readRequest(requestContext) {
  try {
    if (requestContext === null || typeof requestContext !== "object" || Array.isArray(requestContext)) {
      return null;
    }

    const prototype = Object.getPrototypeOf(requestContext);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }

    const ownKeys = Reflect.ownKeys(requestContext);
    if (ownKeys.some((key) => typeof key !== "string")) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(requestContext);
    const readDataProperty = (key) => {
      const descriptor = descriptors[key];
      return descriptor !== undefined && hasOwn(descriptor, "value") && descriptor.enumerable
        ? descriptor.value
        : undefined;
    };
    const targetAction = readDataProperty("targetAction");
    if (typeof targetAction !== "string") {
      return null;
    }

    if (!actionValues.includes(targetAction)) {
      return null;
    }

    if (targetAction === "playbook_dispatch") {
      const playbookId = readDataProperty("playbookId");
      if (ownKeys.length !== 2 || !ownKeys.includes("targetAction") || !ownKeys.includes("playbookId") ||
          typeof playbookId !== "string" || !identifierPattern.test(playbookId)) {
        return null;
      }
      return { targetAction, targetId: playbookId };
    }

    if (targetAction === "executor_dispatch") {
      const executorId = readDataProperty("executorId");
      if (ownKeys.length !== 2 || !ownKeys.includes("targetAction") || !ownKeys.includes("executorId") ||
          typeof executorId !== "string" || !identifierPattern.test(executorId)) {
        return null;
      }
      return { targetAction, targetId: executorId };
    }

    if (ownKeys.length !== 1 || ownKeys[0] !== "targetAction") {
      return null;
    }

    return { targetAction, targetId: null };
  } catch {
    return null;
  }
}

function decision(reasonCode, controlId = null) {
  return deepFreeze({
    schemaVersion: "1.0.0",
    decision: "deny",
    reasonCode,
    controlId
  });
}

function evaluate(request) {
  if (request.targetAction === "autonomous_action") {
    return decision("KILL_SWITCH_GLOBAL_AUTONOMY_ENGAGED", "global-autonomous-actions");
  }
  if (request.targetAction === "playbook_dispatch" && request.targetId === "content-schema-repair-shadow") {
    return decision("KILL_SWITCH_PLAYBOOK_ENGAGED", "playbook-content-schema-repair-shadow");
  }
  if (request.targetAction === "executor_dispatch" && request.targetId === "codex-content-executor") {
    return decision("KILL_SWITCH_EXECUTOR_ENGAGED", "executor-codex-content-executor");
  }
  if (request.targetAction === "codex_dispatch") {
    return decision("KILL_SWITCH_CODEX_DISPATCH_PAUSED", "codex-dispatch");
  }
  if (request.targetAction === "pending_action") {
    return decision("KILL_SWITCH_PENDING_ACTION_REJECTED", "pending-actions");
  }
  if (request.targetAction === "outbound_notification") {
    return decision("KILL_SWITCH_OUTBOUND_NOTIFICATIONS_PAUSED", "outbound-notifications");
  }
  return decision("KILL_SWITCH_NO_MATCH_FAIL_CLOSED");
}

/** Sole public entry point. Caller-supplied authority is neither accepted nor used. */
export function evaluateKillSwitch(requestContext) {
  try {
    if (!authorityIsValid()) {
      return decision("KILL_SWITCH_INTERNAL_AUTHORITY_INVALID");
    }

    const request = readRequest(requestContext);
    if (request === null) {
      return decision("KILL_SWITCH_INVALID_REQUEST");
    }

    return evaluate(request);
  } catch {
    return decision("KILL_SWITCH_INTERNAL_AUTHORITY_INVALID");
  }
}
