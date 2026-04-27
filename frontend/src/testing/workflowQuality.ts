export type WorkflowAuditSeverity = 'error' | 'warning';
export type WorkflowAuditScope = 'workflow' | 'task' | 'edge' | 'comment' | 'access';

export interface WorkflowAuditIssue {
  code: string;
  severity: WorkflowAuditSeverity;
  scope: WorkflowAuditScope;
  message: string;
  targetId?: string | null;
}

type GenericRecord = Record<string, any>;

const DECISION_TYPES = new Set(['LOOP', 'DECISION', 'CONDITION']);
const GENERIC_NAME_TOKENS = new Set(['misc', 'general', 'stuff', 'thing', 'temp', 'test']);
const VISIBILITY_OPTIONS = new Set(['private', 'workspace', 'org']);
const REVIEW_STATE_OPTIONS = new Set(['draft', 'requested', 'in review', 'approved', 'open', 'changes-requested']);
const APPROVAL_STATE_OPTIONS = new Set(['draft', 'pending', 'approved', 'superseded']);

const text = (value: unknown) => String(value ?? '').trim();
const asArray = <T>(value: T[] | undefined | null): T[] => Array.isArray(value) ? value : [];
const asRecordArray = (value: unknown): GenericRecord[] => Array.isArray(value) ? value as GenericRecord[] : [];
const hasValue = (value: unknown) => text(value).length > 0;
const toId = (value: unknown) => text(value);

const pushIssue = (
  issues: WorkflowAuditIssue[],
  severity: WorkflowAuditSeverity,
  scope: WorkflowAuditScope,
  code: string,
  message: string,
  targetId?: string | null,
) => {
  issues.push({ severity, scope, code, message, targetId: targetId ?? null });
};

const uniqueStrings = (values: unknown[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = text(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
};

const normalizeToolList = (value: unknown): string[] => {
  if (Array.isArray(value)) return uniqueStrings(value);
  if (typeof value === 'string') return uniqueStrings(value.split(','));
  return [];
};

const buildGraph = (tasks: GenericRecord[], edges: GenericRecord[]) => {
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  tasks.forEach((task) => {
    const taskId = toId(task.node_id || task.id);
    adjacency.set(taskId, []);
    reverseAdjacency.set(taskId, []);
    indegree.set(taskId, 0);
  });

  edges.forEach((edge) => {
    const source = toId(edge.source);
    const target = toId(edge.target);
    if (!source || !target || !adjacency.has(source) || !adjacency.has(target)) return;
    adjacency.get(source)?.push(target);
    reverseAdjacency.get(target)?.push(source);
    indegree.set(target, (indegree.get(target) || 0) + 1);
  });

  return { adjacency, reverseAdjacency, indegree };
};

const reachable = (starts: string[], adjacency: Map<string, string[]>) => {
  const seen = new Set<string>();
  const queue = [...starts];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    (adjacency.get(current) || []).forEach((next) => {
      if (!seen.has(next)) queue.push(next);
    });
  }
  return seen;
};

const detectCycle = (adjacency: Map<string, string[]>) => {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const cycleNodes = new Set<string>();

  const dfs = (nodeId: string) => {
    if (visiting.has(nodeId)) {
      cycleNodes.add(nodeId);
      return;
    }
    if (visited.has(nodeId)) return;

    visiting.add(nodeId);
    (adjacency.get(nodeId) || []).forEach((neighbor) => {
      if (visiting.has(neighbor)) {
        cycleNodes.add(nodeId);
        cycleNodes.add(neighbor);
        return;
      }
      dfs(neighbor);
      if (cycleNodes.has(neighbor)) cycleNodes.add(nodeId);
    });
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  Array.from(adjacency.keys()).forEach(dfs);
  return Array.from(cycleNodes);
};

export const summarizeAuditIssues = (issues: WorkflowAuditIssue[]) => {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  if (errors.length === 0 && warnings.length === 0) {
    return 'No quality issues detected.';
  }
  const top = [...errors, ...warnings][0];
  const parts = [];
  if (errors.length > 0) parts.push(`${errors.length} error${errors.length === 1 ? '' : 's'}`);
  if (warnings.length > 0) parts.push(`${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
  return `${parts.join(', ')} detected. ${top.message}`;
};

export const hasAuditErrors = (issues: WorkflowAuditIssue[]) => issues.some((issue) => issue.severity === 'error');

export const auditIntakePayload = (payload: GenericRecord) => {
  const issues: WorkflowAuditIssue[] = [];
  const workflowType = text(payload?.workflow_type).toLowerCase();

  if (!hasValue(payload?.name) || text(payload.name).length < 2) {
    pushIssue(issues, 'error', 'workflow', 'workflow.name', 'Workflow name must be at least 2 characters long.');
  }
  if (!hasValue(payload?.description)) {
    pushIssue(issues, 'error', 'workflow', 'workflow.description', 'Workflow description is required.');
  }
  ['prc', 'workflow_type', 'org', 'team', 'trigger_type', 'trigger_description', 'output_type', 'output_description'].forEach((field) => {
    if (!hasValue(payload?.[field])) {
      pushIssue(issues, 'error', 'workflow', `workflow.${field}`, `${field.replaceAll('_', ' ')} is required.`);
    }
  });

  if ((Number(payload?.cadence_count) || 0) <= 0) {
    pushIssue(issues, 'error', 'workflow', 'workflow.cadence_count', 'Cadence count must be greater than zero.');
  }

  const toolFamilies = normalizeToolList(payload?.tool_family);
  const applicableTools = normalizeToolList(payload?.applicable_tools ?? payload?.tool_id);
  if (toolFamilies.length === 0) {
    pushIssue(issues, 'error', 'workflow', 'workflow.tool_family', 'At least one tool family is required.');
  }
  if (applicableTools.length === 0) {
    pushIssue(issues, 'error', 'workflow', 'workflow.applicable_tools', 'At least one applicable tool is required.');
  }

  if (payload?.equipment_required && !hasValue(payload?.equipment_state)) {
    pushIssue(issues, 'error', 'workflow', 'workflow.equipment_state', 'Equipment state is required when equipment is involved.');
  }

  if (payload?.repeatability_check !== true) {
    pushIssue(issues, 'error', 'workflow', 'workflow.repeatability_check', 'Only repeatable, standard workflows should pass intake.');
  }

  const access = payload?.access_control || {};
  if (!hasValue(access.owner)) {
    pushIssue(issues, 'warning', 'access', 'access.owner', 'Access control owner should be populated.');
  }
  if (!hasValue(access.visibility)) {
    pushIssue(issues, 'warning', 'access', 'access.visibility', 'Access control visibility should be populated.');
  } else if (!VISIBILITY_OPTIONS.has(text(access.visibility).toLowerCase())) {
    pushIssue(issues, 'warning', 'access', 'access.visibility_vocab', 'Visibility should use the controlled application vocabulary.');
  }

  if (GENERIC_NAME_TOKENS.has(text(payload?.name).toLowerCase())) {
    pushIssue(issues, 'warning', 'workflow', 'workflow.name_generic', 'Workflow name should use operational terminology rather than placeholder naming.');
  }

  const ownership = payload?.ownership || {};
  const governance = payload?.governance || {};
  if (hasValue(governance?.review_state) && !REVIEW_STATE_OPTIONS.has(text(governance.review_state).toLowerCase())) {
    pushIssue(issues, 'warning', 'workflow', 'workflow.review_state_vocab', 'Review state should use the controlled workflow vocabulary.');
  }
  if (hasValue(governance?.approval_state) && !APPROVAL_STATE_OPTIONS.has(text(governance.approval_state).toLowerCase())) {
    pushIssue(issues, 'warning', 'workflow', 'workflow.approval_state_vocab', 'Approval state should use the controlled workflow vocabulary.');
  }
  if (workflowType.includes('handoff')) {
    if (!hasValue(ownership?.owner)) {
      pushIssue(issues, 'error', 'workflow', 'workflow.handoff_owner', 'Shift handoff workflows require a named workflow owner.');
    }
    if (asArray(governance?.required_reviewer_roles).length === 0) {
      pushIssue(issues, 'error', 'workflow', 'workflow.handoff_review_roles', 'Shift handoff workflows require reviewer roles.');
    }
    if (asArray(ownership?.smes).length === 0) {
      pushIssue(issues, 'warning', 'workflow', 'workflow.handoff_sme', 'Shift handoff workflows should identify at least one SME.');
    }
  }
  if (workflowType.includes('automation')) {
    if (!hasValue(ownership?.automation_owner)) {
      pushIssue(issues, 'error', 'workflow', 'workflow.automation_owner', 'Automation study workflows require an automation owner.');
    }
    if (!hasValue(payload?.quick_capture_notes) && !hasValue(payload?.version_notes)) {
      pushIssue(issues, 'warning', 'workflow', 'workflow.automation_context', 'Automation-oriented workflows should capture current-state notes or version rationale.');
    }
    if (asArray(payload?.review_requests).length === 0) {
      pushIssue(issues, 'warning', 'workflow', 'workflow.automation_review_request', 'Automation-oriented workflows should start with at least one review request.');
    }
  }

  asRecordArray(payload?.comments).forEach((comment, index) => {
    if (!hasValue(comment?.message)) {
      pushIssue(issues, 'warning', 'comment', 'comment.message', `Comment ${index + 1} has no message.`);
    }
  });

  return issues;
};

export const auditWorkflowDraft = (input: {
  metadata: GenericRecord;
  tasks: GenericRecord[];
  edges: GenericRecord[];
}) => {
  const issues = auditIntakePayload(input.metadata);
  const tasks = asArray(input.tasks);
  const edges = asArray(input.edges);
  const workflowType = text(input.metadata?.workflow_type).toLowerCase();
  const taskMap = new Map<string, GenericRecord>();
  const outputIds = new Set<string>();

  tasks.forEach((task, index) => {
    const taskId = toId(task.node_id || task.id);
    const label = text(task.name) || `Task ${index + 1}`;

    if (!taskId) {
      pushIssue(issues, 'error', 'task', 'task.id', `${label} is missing a stable task/node identifier.`);
      return;
    }
    if (taskMap.has(taskId)) {
      pushIssue(issues, 'error', 'task', 'task.duplicate_id', `${label} duplicates task identifier ${taskId}.`, taskId);
    }
    taskMap.set(taskId, task);

    if (!hasValue(task.name)) {
      pushIssue(issues, 'error', 'task', 'task.name', 'Task name is required.', taskId);
    } else if (GENERIC_NAME_TOKENS.has(text(task.name).toLowerCase())) {
      pushIssue(issues, 'warning', 'task', 'task.name_generic', `Task "${label}" should use standard operational terminology instead of placeholder naming.`, taskId);
    }
    if (!hasValue(task.description)) {
      pushIssue(issues, 'error', 'task', 'task.description', `Task "${label}" is missing a description.`, taskId);
    }

    ['manual_time_minutes', 'automation_time_minutes', 'machine_wait_time_minutes'].forEach((field) => {
      if ((Number(task[field]) || 0) < 0) {
        pushIssue(issues, 'error', 'task', `task.${field}`, `Task "${label}" has a negative ${field.replaceAll('_', ' ')}.`, taskId);
      }
    });
    if ((Number(task.occurrence) || 0) <= 0) {
      pushIssue(issues, 'error', 'task', 'task.occurrence', `Task "${label}" must have an occurrence greater than zero.`, taskId);
    }

    const outputItems = asRecordArray(task.output_data_list);
    outputItems.forEach((item) => {
      const outputId = toId(item?.id);
      if (outputId) outputIds.add(outputId);
    });

    const dataItems = [...asRecordArray(task.source_data_list), ...outputItems];
    const dataIds = new Set<string>();
    dataItems.forEach((item, itemIndex) => {
      const itemId = toId(item?.id);
      if (itemId) {
        if (dataIds.has(itemId)) {
          pushIssue(issues, 'warning', 'task', 'task.duplicate_data_id', `Task "${label}" contains duplicate data item id ${itemId}.`, taskId);
        }
        dataIds.add(itemId);
      }
      if (!hasValue(item?.name)) {
        pushIssue(issues, 'warning', 'task', 'task.data_name', `Task "${label}" has an unnamed data item at position ${itemIndex + 1}.`, taskId);
      }
    });

    asRecordArray(task.blockers).forEach((blocker, blockerIndex) => {
      if (!hasValue(blocker?.blocking_entity) || !hasValue(blocker?.reason) || !hasValue(blocker?.standard_mitigation)) {
        pushIssue(issues, 'error', 'task', 'task.blocker_incomplete', `Task "${label}" has an incomplete blocker at position ${blockerIndex + 1}.`, taskId);
      }
    });

    asRecordArray(task.errors).forEach((error, errorIndex) => {
      if (!hasValue(error?.error_type) || !hasValue(error?.description)) {
        pushIssue(issues, 'error', 'task', 'task.error_incomplete', `Task "${label}" has an incomplete error entry at position ${errorIndex + 1}.`, taskId);
      }
    });

    if (task.validation_needed && asArray(task.validation_procedure_steps).length === 0) {
      pushIssue(issues, 'warning', 'task', 'task.validation_missing_steps', `Task "${label}" requires validation but has no validation steps.`, taskId);
    }
    asRecordArray(task.validation_procedure_steps).forEach((step, stepIndex) => {
      if (!hasValue(step?.description)) {
        pushIssue(issues, 'error', 'task', 'task.validation_step', `Task "${label}" has a blank validation step at position ${stepIndex + 1}.`, taskId);
      }
    });

    asRecordArray(task.reference_links).forEach((reference, referenceIndex) => {
      if (!hasValue(reference?.url)) {
        pushIssue(issues, 'warning', 'task', 'task.reference_url', `Task "${label}" has a blank reference URL at position ${referenceIndex + 1}.`, taskId);
      }
    });

    asRecordArray(task.instructions).forEach((instruction, instructionIndex) => {
      if (!hasValue(instruction?.description)) {
        pushIssue(issues, 'warning', 'task', 'task.instruction_description', `Task "${label}" has a blank instruction at position ${instructionIndex + 1}.`, taskId);
      }
    });

    asRecordArray(task.media).forEach((asset, assetIndex) => {
      if (!hasValue(asset?.url)) {
        pushIssue(issues, 'warning', 'task', 'task.media_url', `Task "${label}" has a media asset without a URL at position ${assetIndex + 1}.`, taskId);
      }
    });
  });

  tasks.forEach((task) => {
    const taskId = toId(task.node_id || task.id);
    const label = text(task.name) || taskId;
    asRecordArray(task.source_data_list).forEach((item, itemIndex) => {
      const fromTaskId = toId(item?.from_task_id);
      if (fromTaskId && !outputIds.has(fromTaskId)) {
        pushIssue(issues, 'warning', 'task', 'task.orphaned_input', `Task "${label}" references a missing upstream output at input ${itemIndex + 1}.`, taskId);
      }
    });
  });

  if (workflowType.includes('verification') || workflowType.includes('calibration') || workflowType.includes('inspection')) {
    const validationTasks = tasks.filter((task) => !text(task.interface).toUpperCase() && task.validation_needed);
    if (validationTasks.length === 0) {
      pushIssue(issues, 'warning', 'workflow', 'workflow.validation_presence', 'Verification-style workflows should identify at least one validating task.');
    }
  }

  const { adjacency, reverseAdjacency, indegree } = buildGraph(tasks, edges);
  const edgeKeys = new Set<string>();

  edges.forEach((edge, index) => {
    const source = toId(edge.source);
    const target = toId(edge.target);
    const label = text(edge.label ?? edge.data?.label);
    const key = [source, target, label.toLowerCase()].join('::');

    if (!source || !target) {
      pushIssue(issues, 'error', 'edge', 'edge.endpoint_missing', `Edge ${index + 1} is missing a source or target.`);
      return;
    }
    if (!taskMap.has(source) || !taskMap.has(target)) {
      pushIssue(issues, 'error', 'edge', 'edge.endpoint_invalid', `Edge ${index + 1} references a missing node.`, target || source);
    }
    if (source === target) {
      pushIssue(issues, 'error', 'edge', 'edge.self_loop', `Edge ${index + 1} creates a self-loop on ${source}.`, source);
    }
    if (edgeKeys.has(key)) {
      pushIssue(issues, 'warning', 'edge', 'edge.duplicate', `Duplicate route detected from ${source} to ${target}${label ? ` (${label})` : ''}.`, source);
    }
    edgeKeys.add(key);
  });

  const cycleNodes = detectCycle(adjacency);
  cycleNodes.forEach((nodeId) => {
    pushIssue(issues, 'error', 'edge', 'graph.cycle', `Node ${nodeId} participates in a routing cycle.`, nodeId);
  });

  const triggerNodes = tasks
    .filter((task) => text(task.interface).toUpperCase() === 'TRIGGER')
    .map((task) => toId(task.node_id || task.id));
  const outcomeNodes = tasks
    .filter((task) => text(task.interface).toUpperCase() === 'OUTCOME')
    .map((task) => toId(task.node_id || task.id));

  if (triggerNodes.length === 0) {
    pushIssue(issues, 'warning', 'workflow', 'workflow.trigger_missing', 'Workflow has no trigger node defined.');
  }
  if (outcomeNodes.length === 0) {
    pushIssue(issues, 'warning', 'workflow', 'workflow.outcome_missing', 'Workflow has no outcome node defined.');
  }

  const roots = triggerNodes.length > 0 ? triggerNodes : Array.from(indegree.entries()).filter(([, degree]) => degree === 0).map(([nodeId]) => nodeId);
  const sinks = outcomeNodes.length > 0 ? outcomeNodes : Array.from(taskMap.keys()).filter((nodeId) => (adjacency.get(nodeId) || []).length === 0);

  const reachableFromRoot = reachable(roots, adjacency);
  const canReachSink = reachable(sinks, reverseAdjacency);
  taskMap.forEach((task, nodeId) => {
    if (!reachableFromRoot.has(nodeId)) {
      pushIssue(issues, 'error', 'task', 'graph.unreachable', `Task "${text(task.name) || nodeId}" is unreachable from the trigger path.`, nodeId);
    }
    if (!canReachSink.has(nodeId)) {
      pushIssue(issues, 'error', 'task', 'graph.disconnected', `Task "${text(task.name) || nodeId}" does not reach an outcome path.`, nodeId);
    }
  });

  triggerNodes.forEach((nodeId) => {
    if ((reverseAdjacency.get(nodeId) || []).length > 0) {
      pushIssue(issues, 'error', 'edge', 'graph.trigger_incoming', 'Trigger nodes cannot have incoming routes.', nodeId);
    }
  });
  outcomeNodes.forEach((nodeId) => {
    if ((adjacency.get(nodeId) || []).length > 0) {
      pushIssue(issues, 'error', 'edge', 'graph.outcome_outgoing', 'Outcome nodes cannot have outgoing routes.', nodeId);
    }
  });

  tasks.forEach((task) => {
    const taskId = toId(task.node_id || task.id);
    if (!DECISION_TYPES.has(text(task.task_type).toUpperCase())) return;
    const outgoingEdges = edges.filter((edge) => toId(edge.source) === taskId);
    const labels = outgoingEdges.map((edge) => text(edge.label ?? edge.data?.label).toLowerCase()).filter(Boolean);
    if (outgoingEdges.length !== 2) {
      pushIssue(issues, 'error', 'edge', 'graph.decision_route_count', `Decision node "${text(task.name) || taskId}" must expose exactly two outgoing routes.`, taskId);
      return;
    }
    if (!labels.includes('true') || !labels.includes('false')) {
      pushIssue(issues, 'error', 'edge', 'graph.decision_labels', `Decision node "${text(task.name) || taskId}" must use True and False route labels.`, taskId);
    }
  });

  return issues;
};
