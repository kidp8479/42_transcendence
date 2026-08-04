// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows.
//
// Placeholder shown inside a kanban column with no tasks. Rendered inside the
// column's droppable area, so an empty column still offers a visible target
// to drop a dragged card into.
export function EmptyColumnState() {
  return (
    <div className="rounded-lg border border-dashed border-surface-border p-4 text-center text-xs text-text-muted-on-base">
      No tasks
    </div>
  );
}
