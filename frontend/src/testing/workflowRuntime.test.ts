import test from 'node:test';
import assert from 'node:assert/strict';

import { validateBuilderRuntimeState } from './workflowRuntime.ts';

test('validateBuilderRuntimeState accepts aligned node/task/edge state', () => {
  const result = validateBuilderRuntimeState({
    nodes: [
      { id: 'node-trigger', data: { interface: 'TRIGGER' } },
      { id: 'node-task', data: {} },
      { id: 'node-outcome', data: { interface: 'OUTCOME' } },
    ],
    tasks: [
      { id: 'node-trigger', node_id: 'node-trigger', interface: 'TRIGGER' },
      { id: 'node-task', node_id: 'node-task' },
      { id: 'node-outcome', node_id: 'node-outcome', interface: 'OUTCOME' },
    ],
    edges: [
      { id: 'edge-1', source: 'node-trigger', target: 'node-task' },
      { id: 'edge-2', source: 'node-task', target: 'node-outcome' },
    ],
    selectedTaskId: 'node-task',
    selectedEdgeId: 'edge-1',
  });

  assert.equal(result.issues.filter(issue => issue.severity === 'error').length, 0);
  assert.equal(result.repairs.clearSelectedTask, false);
  assert.equal(result.repairs.clearSelectedEdge, false);
});

test('validateBuilderRuntimeState flags missing task/node pairs and broken selections', () => {
  const result = validateBuilderRuntimeState({
    nodes: [
      { id: 'node-trigger', data: { interface: 'TRIGGER' } },
      { id: 'node-outcome', data: { interface: 'OUTCOME' } },
      { id: 'node-lonely', data: {} },
    ],
    tasks: [
      { id: 'node-trigger', node_id: 'node-trigger', interface: 'TRIGGER' },
      { id: 'node-outcome', node_id: 'node-outcome', interface: 'OUTCOME' },
      { id: 'node-detached', node_id: 'node-detached' },
    ],
    edges: [
      { id: 'edge-1', source: 'node-trigger', target: 'node-missing' },
    ],
    selectedTaskId: 'node-ghost',
    selectedEdgeId: 'edge-ghost',
  });

  assert(result.issues.some(issue => issue.code === 'runtime.node_without_task'));
  assert(result.issues.some(issue => issue.code === 'runtime.task_without_node'));
  assert(result.issues.some(issue => issue.code === 'runtime.edge_missing_node'));
  assert(result.issues.some(issue => issue.code === 'runtime.selected_task_missing'));
  assert(result.issues.some(issue => issue.code === 'runtime.selected_edge_missing'));
  assert.equal(result.repairs.clearSelectedTask, true);
  assert.equal(result.repairs.clearSelectedEdge, true);
});
