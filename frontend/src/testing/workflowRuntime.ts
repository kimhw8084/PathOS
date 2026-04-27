export interface RuntimeInvariantIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  targetId?: string | null;
}

export interface RuntimeInvariantResult {
  issues: RuntimeInvariantIssue[];
  repairs: {
    clearSelectedTask: boolean;
    clearSelectedEdge: boolean;
  };
}

type BuilderEntity = Record<string, any>;

const text = (value: unknown) => String(value ?? '').trim();

export const validateBuilderRuntimeState = (input: {
  nodes: BuilderEntity[];
  edges: BuilderEntity[];
  tasks: BuilderEntity[];
  selectedTaskId?: string | null;
  selectedEdgeId?: string | null;
}) => {
  const issues: RuntimeInvariantIssue[] = [];
  const nodeIds = new Set<string>();
  const taskIds = new Set<string>();
  const triggerIds: string[] = [];
  const outcomeIds: string[] = [];

  input.nodes.forEach((node) => {
    const nodeId = text(node.id);
    if (!nodeId) {
      issues.push({ code: 'runtime.node_missing_id', severity: 'error', message: 'A canvas node is missing an id.' });
      return;
    }
    if (nodeIds.has(nodeId)) {
      issues.push({ code: 'runtime.duplicate_node_id', severity: 'error', message: `Duplicate node id detected: ${nodeId}.`, targetId: nodeId });
    }
    nodeIds.add(nodeId);
    if (text(node.data?.interface).toUpperCase() === 'TRIGGER') triggerIds.push(nodeId);
    if (text(node.data?.interface).toUpperCase() === 'OUTCOME') outcomeIds.push(nodeId);
  });

  input.tasks.forEach((task) => {
    const taskId = text(task.node_id || task.id);
    if (!taskId) {
      issues.push({ code: 'runtime.task_missing_id', severity: 'error', message: 'A task record is missing a node/task id.' });
      return;
    }
    if (taskIds.has(taskId)) {
      issues.push({ code: 'runtime.duplicate_task_id', severity: 'error', message: `Duplicate task id detected: ${taskId}.`, targetId: taskId });
    }
    taskIds.add(taskId);
    if (!nodeIds.has(taskId)) {
      issues.push({ code: 'runtime.task_without_node', severity: 'error', message: `Task ${taskId} has no matching canvas node.`, targetId: taskId });
    }
  });

  input.nodes.forEach((node) => {
    const nodeId = text(node.id);
    if (nodeId && !taskIds.has(nodeId)) {
      issues.push({ code: 'runtime.node_without_task', severity: 'error', message: `Canvas node ${nodeId} has no matching task record.`, targetId: nodeId });
    }
  });

  if (triggerIds.length !== 1) {
    issues.push({
      code: 'runtime.trigger_count',
      severity: 'error',
      message: `Builder must contain exactly one trigger node. Found ${triggerIds.length}.`,
      targetId: triggerIds[0] || null,
    });
  }
  if (outcomeIds.length !== 1) {
    issues.push({
      code: 'runtime.outcome_count',
      severity: 'error',
      message: `Builder must contain exactly one outcome node. Found ${outcomeIds.length}.`,
      targetId: outcomeIds[0] || null,
    });
  }

  input.edges.forEach((edge, index) => {
    const edgeId = text(edge.id);
    const source = text(edge.source);
    const target = text(edge.target);
    if (!source || !target) {
      issues.push({ code: 'runtime.edge_missing_endpoint', severity: 'error', message: `Edge ${edgeId || index + 1} is missing an endpoint.` });
      return;
    }
    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      issues.push({
        code: 'runtime.edge_missing_node',
        severity: 'error',
        message: `Edge ${edgeId || index + 1} references a missing node.`,
        targetId: !nodeIds.has(source) ? source : target,
      });
    }
  });

  const clearSelectedTask = !!input.selectedTaskId && !taskIds.has(text(input.selectedTaskId));
  const clearSelectedEdge = !!input.selectedEdgeId && !input.edges.some((edge) => text(edge.id) === text(input.selectedEdgeId));

  if (clearSelectedTask) {
    issues.push({
      code: 'runtime.selected_task_missing',
      severity: 'warning',
      message: 'Selected task no longer exists and will be cleared.',
      targetId: text(input.selectedTaskId),
    });
  }
  if (clearSelectedEdge) {
    issues.push({
      code: 'runtime.selected_edge_missing',
      severity: 'warning',
      message: 'Selected route no longer exists and will be cleared.',
      targetId: text(input.selectedEdgeId),
    });
  }

  return {
    issues,
    repairs: {
      clearSelectedTask,
      clearSelectedEdge,
    },
  } satisfies RuntimeInvariantResult;
};
