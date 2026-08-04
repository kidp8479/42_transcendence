// Detail drawer for a kanban card: edits title, status, category, priority,
// members and notes over a TaskDraft, then hands the draft up - the route
// decides whether that means create or update. DrawerShell owns the backdrop,
// click-outside, Escape and the slide animation; fullscreen lives here and
// reaches the shell as a width class.
//
// Confined to the tab's content area: DrawerShell is absolute and its
// containing block is ProjectLayout's anchor, so the panel runs from the tab
// bar's rule down to the footer, leaving the project title and tabs reachable
// (same as CalendarEventDrawer).
//
// Split in two on purpose: the shell wrapper mounts once and lives forever -
// remounting it on open would drop the slide-in, a freshly mounted panel
// renders already in place - while KanbanCardForm is re-keyed on `session`, so
// every open starts from a clean draft with no state-syncing effect. The form
// is deliberately NOT gated on isOpen, or the panel would empty mid slide-out.
//
// Fields intentionally absent (not in the design mockup): startAt/endAt,
// description, onCalendar. A PATCH is partial, so editing here preserves them.
import { useState, type KeyboardEvent } from "react";
import { Button, Label, Textarea } from "flowbite-react";
import { HiOutlineArrowsExpand, HiOutlineX } from "react-icons/hi";
import {
  CATEGORY_COLOR_PALETTE,
  getCategoryColor,
} from "@/lib/categoryColorPalette";
import { darkSurfaceFieldClassName } from "@/lib/flowbite";
import {
  PRIORITY_ORDER,
  PRIORITY_SEGMENT_INACTIVE,
  PRIORITY_STYLES,
} from "@/lib/taskPriorityStyles";
import { STATUS_ORDER, STATUS_STYLES } from "@/lib/taskStatusStyles";
import {
  TASK_NOTES_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  type Task,
  type TaskAssigneeUser,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";
import type { TaskCategory } from "@/lib/taskCategories";
import { DrawerShell } from "@/components/drawers/DrawerShell";
import { TaskCategoryBadge } from "@/components/kanban/TaskCategoryBadge";
import { TaskPriorityDot } from "@/components/kanban/TaskPriorityDot";
import { assigneeColorIndex } from "@/components/kanban/TaskAssignees";

// The fields this form edits - a subset of Task, with assignees as plain ids.
export interface TaskDraft {
  title: string;
  categoryId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeIds: string[];
  notes: string;
}

interface KanbanCardDrawerProps {
  // The shell stays mounted so its slide-out can play, so this drives the
  // animation rather than the route mounting/unmounting the drawer.
  isOpen: boolean;
  // Changes on every open; keys the form so it resets even when the same card
  // is reopened. See the header comment.
  session: number;
  mode: "create" | "edit";
  // the task being edited; null in create mode
  task: Task | null;
  // status column whose "+" was clicked (create mode's preset)
  initialStatus: TaskStatus;
  categories: TaskCategory[];
  members: TaskAssigneeUser[];
  onClose: () => void;
  // Widened to allow a Promise so the form can await it and lock its buttons
  // while the request is in flight - the route handler is async.
  //
  // Two drafts, not one: `initialDraft` is what the drawer opened on, and the
  // route sends only the fields that differ from it. The drawer stays dumb about
  // the API - it just reports "here is where this started, here is where it is
  // now" - and the route keeps owning the request shape.
  onSubmit: (draft: TaskDraft, initialDraft: TaskDraft) => void | Promise<void>;
}

const DRAWER_HEADING_ID = "kanban-card-drawer-heading";

// Field labels: same uppercase micro-label as the Discovery edit screen, with
// the column width this drawer's two-column rows need.
const FIELD_LABEL_CLASS =
  "w-24 shrink-0 text-xs font-semibold tracking-wide text-text-secondary uppercase";

const ICON_BUTTON_CLASS =
  "rounded-md p-1.5 text-text-secondary hover:bg-surface-overlay hover:text-text-primary focus:ring-2 focus:ring-brand-500/40 focus:outline-none";

export function KanbanCardDrawer({
  isOpen,
  session,
  mode,
  task,
  initialStatus,
  categories,
  members,
  onClose,
  onSubmit,
}: KanbanCardDrawerProps) {
  // Kept out of the form so it survives the form's re-keying, which is also why
  // fullscreen carries over from one card to the next - same as the calendar
  // drawer's expanded state.
  const [is_fullscreen, setIsFullscreen] = useState(false);

  // Staged Escape: leave fullscreen on the first press, close on the second.
  // DrawerShell's Escape listener already takes priority over the sidebar's, so
  // this doesn't have to know the sidebar exists.
  function handleEscape() {
    if (is_fullscreen) {
      setIsFullscreen(false);
      return;
    }
    onClose();
  }

  return (
    <DrawerShell
      isOpen={isOpen}
      onClose={onClose}
      onEscape={handleEscape}
      // Fullscreen is just the panel widened to the whole content area - the
      // same mechanism as CalendarEventDrawer's expand.
      widthClassName={is_fullscreen ? "w-full" : "max-w-md"}
      titleId={DRAWER_HEADING_ID}
    >
      {/* Outside the form so the dialog keeps its accessible name while the
          form remounts. */}
      <h2 id={DRAWER_HEADING_ID} className="sr-only">
        {mode === "create" ? "Create task" : `Edit task ${task?.title ?? ""}`}
      </h2>

      <KanbanCardForm
        key={session}
        mode={mode}
        task={task}
        initialStatus={initialStatus}
        categories={categories}
        members={members}
        onClose={onClose}
        onSubmit={onSubmit}
        isFullscreen={is_fullscreen}
        onToggleFullscreen={() => setIsFullscreen((previous) => !previous)}
      />
    </DrawerShell>
  );
}

// Everything that reads the draft, so that re-keying it on open resets the form
// without touching the shell. Renders a fragment, not a wrapper div: these stay
// direct flex children of DrawerShell's panel.
interface KanbanCardFormProps {
  mode: "create" | "edit";
  task: Task | null;
  initialStatus: TaskStatus;
  categories: TaskCategory[];
  members: TaskAssigneeUser[];
  onClose: () => void;
  onSubmit: (draft: TaskDraft, initialDraft: TaskDraft) => void | Promise<void>;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

// The draft a freshly opened form starts from. Pulled out of the component so the
// edited draft and the untouched reference below are the same value by
// construction - the diff on save is only meaningful if its comparison point
// never moved.
function buildInitialDraft(
  task: Task | null,
  members: TaskAssigneeUser[],
  initialStatus: TaskStatus
): TaskDraft {
  if (task === null) {
    return {
      title: "",
      categoryId: null,
      status: initialStatus,
      priority: "MEDIUM",
      assigneeIds: [],
      notes: "",
    };
  }

  return {
    title: task.title,
    categoryId: task.categoryId,
    status: task.status,
    priority: task.priority,
    // Assignees who are no longer members of the project are dropped here.
    // Removing a member deletes the ProjectMember row only - TaskAssignee's
    // only cascade is on User deletion, so the server keeps returning that
    // user in task.assignees. The picker below renders one button per CURRENT
    // member, so a stale id has no control to remove it, and the server
    // rejects any assigneeId that isn't a current member - without this
    // filter the task would become unsavable entirely, for any field.
    assigneeIds: task.assignees
      .filter((assignee) => members.some((member) => member.id === assignee.id))
      .map((assignee) => assignee.id),
    notes: task.notes ?? "",
  };
}

function KanbanCardForm({
  mode,
  task,
  initialStatus,
  categories,
  members,
  onClose,
  onSubmit,
  isFullscreen,
  onToggleFullscreen,
}: KanbanCardFormProps) {
  // Validation messages only appear after a failed submit attempt, not while
  // the user is still filling the form in.
  const [show_errors, setShowErrors] = useState(false);
  // Guards against a double click creating two tasks. Safe to reset in the
  // finally below even after a successful submit closes the drawer: the panel
  // stays mounted so it can animate out, so this component is still there.
  const [is_submitting, setIsSubmitting] = useState(false);

  // Two states, one value. initial_draft is frozen at mount - this component is
  // keyed on `session`, so mounting IS opening - and form_draft starts as a copy
  // of it. Save diffs the two, which is what keeps an untouched field from being
  // resent and silently reverting a change made elsewhere in the meantime.
  const [initial_draft] = useState<TaskDraft>(() =>
    buildInitialDraft(task, members, initialStatus)
  );
  const [form_draft, setFormDraft] = useState<TaskDraft>(initial_draft);

  const selected_category =
    form_draft.categoryId !== null
      ? (categories.find((category) => category.id === form_draft.categoryId) ??
        null)
      : null;
  const selected_category_color =
    selected_category !== null
      ? getCategoryColor(selected_category.color)
      : null;

  const title_error = show_errors && form_draft.title.trim() === "";
  const category_error = show_errors && form_draft.categoryId === null;

  async function handleSubmit() {
    if (is_submitting) {
      return;
    }
    if (form_draft.title.trim() === "" || form_draft.categoryId === null) {
      setShowErrors(true);
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(
        { ...form_draft, title: form_draft.title.trim() },
        initial_draft
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Arrow keys move the selection AND the focus, wrapping around, the way a
  // native radio group behaves. Up/Left go back, Down/Right forward - both pairs
  // because the group reads as a row but assistive tech may announce either.
  function handlePriorityKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) {
      return;
    }
    // Otherwise the arrows would also scroll the drawer's content.
    event.preventDefault();

    const current_index = PRIORITY_ORDER.indexOf(form_draft.priority);
    const next_priority =
      PRIORITY_ORDER[
        (current_index + step + PRIORITY_ORDER.length) % PRIORITY_ORDER.length
      ];
    setFormDraft((draft) => ({ ...draft, priority: next_priority }));
    // The focus has to follow the selection, or the next arrow press would
    // still be handled from the old button.
    event.currentTarget
      .querySelector<HTMLButtonElement>(`[data-priority="${next_priority}"]`)
      ?.focus();
  }

  function toggleMember(memberId: string) {
    setFormDraft((draft) => ({
      ...draft,
      assigneeIds: draft.assigneeIds.includes(memberId)
        ? draft.assigneeIds.filter((id) => id !== memberId)
        : [...draft.assigneeIds, memberId],
    }));
  }

  return (
    <>
      {/* Accent bar - the selected category's color, live. */}
      <div
        aria-hidden="true"
        className={`h-1 w-full shrink-0 ${selected_category_color !== null ? selected_category_color.bg : "bg-surface-border"}`}
      />

      <div className="flex shrink-0 items-center gap-2 border-b border-surface-border p-4">
        <TaskCategoryBadge category={selected_category} />
        <TaskPriorityDot priority={form_draft.priority} />
        {/* Cosmetic reference only: tasks have no human-readable number, so
            edit mode shows the first uuid segment. A real task number would
            need backend support. */}
        <span className="font-mono text-xs text-text-muted">
          {mode === "edit" && task !== null
            ? `#${task.id.slice(0, 8)}`
            : "New task"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-pressed={isFullscreen}
            aria-label={
              isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"
            }
            title={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
            className={ICON_BUTTON_CLASS}
          >
            <HiOutlineArrowsExpand aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            title="Close drawer"
            className={ICON_BUTTON_CLASS}
          >
            <HiOutlineX aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* min-h-0 is load-bearing: a flex item defaults to min-height:auto,
          which refuses to shrink below its content (title + fields + the
          notes textarea's min-h-40) - without it this grew past the drawer's
          own height instead of scrolling internally, pushing Discard/Save
          off-screen on any viewport shorter than the form. */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <div>
          {/* A real label, not just a placeholder: the placeholder vanishes as
              soon as there is a title, leaving nothing on screen to say what
              this field is - every other field here keeps its label. */}
          <Label htmlFor="kanban-drawer-title" className={FIELD_LABEL_CLASS}>
            Title
          </Label>
          <input
            id="kanban-drawer-title"
            type="text"
            value={form_draft.title}
            onChange={(event) =>
              setFormDraft((draft) => ({ ...draft, title: event.target.value }))
            }
            placeholder="Task title"
            maxLength={TASK_TITLE_MAX_LENGTH}
            className="mt-1 w-full bg-transparent font-mono text-lg font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            {title_error ? (
              <p className="text-xs text-control-error">Title is required</p>
            ) : (
              <span />
            )}
            {/* maxLength already blocks the 101st character; the counter is
                what explains why typing stopped. */}
            <span className="shrink-0 text-xs text-text-muted">
              {form_draft.title.length} / {TASK_TITLE_MAX_LENGTH}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Label htmlFor="kanban-drawer-status" className={FIELD_LABEL_CLASS}>
            Status
          </Label>
          {/* Native selects here on purpose: their whole point is carrying the
              live status/category tint, which a Flowbite Select theme would
              fight. The board itself is neutral inside its columns, so these two
              selects are the only tinted controls left - here the colour states
              the value the user picked, it doesn't just label a fixed column. */}
          <select
            id="kanban-drawer-status"
            value={form_draft.status}
            onChange={(event) =>
              setFormDraft((draft) => ({
                ...draft,
                status: event.target.value as TaskStatus,
              }))
            }
            className={`rounded-lg border px-3 py-1.5 text-sm ${STATUS_STYLES[form_draft.status].statusPill}`}
          >
            {STATUS_ORDER.map((status) => (
              <option
                key={status}
                value={status}
                className="bg-surface-raised text-text-primary"
              >
                {STATUS_STYLES[status].label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <Label htmlFor="kanban-drawer-category" className={FIELD_LABEL_CLASS}>
            Category
          </Label>
          <div>
            <select
              id="kanban-drawer-category"
              value={form_draft.categoryId ?? ""}
              onChange={(event) =>
                setFormDraft((draft) => ({
                  ...draft,
                  categoryId:
                    event.target.value === "" ? null : event.target.value,
                }))
              }
              className={
                selected_category_color !== null
                  ? `rounded-lg border px-3 py-1.5 text-sm ${selected_category_color.badgeBg} ${selected_category_color.badgeBorder} ${selected_category_color.text}`
                  : "rounded-lg border border-surface-border bg-surface-overlay px-3 py-1.5 text-sm text-text-primary"
              }
            >
              <option value="" className="bg-surface-raised text-text-primary">
                Select a category
              </option>
              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                  className="bg-surface-raised text-text-primary"
                >
                  {category.name}
                </option>
              ))}
            </select>
            {category_error && (
              <p className="mt-1 text-xs text-control-error">
                Category is required
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span id="kanban-drawer-priority-label" className={FIELD_LABEL_CLASS}>
            Priority
          </span>
          {/* A radiogroup promises native radio behaviour: ONE tab stop for the
              whole group, then arrows to move between options. That takes both
              the key handler below and the roving tabindex on each button -
              either one alone leaves the promise half-kept. */}
          <div
            role="radiogroup"
            aria-labelledby="kanban-drawer-priority-label"
            onKeyDown={handlePriorityKeyDown}
            className="flex gap-2"
          >
            {PRIORITY_ORDER.map((priority) => (
              <button
                key={priority}
                data-priority={priority}
                tabIndex={form_draft.priority === priority ? 0 : -1}
                type="button"
                role="radio"
                aria-checked={form_draft.priority === priority}
                onClick={() =>
                  setFormDraft((draft) => ({ ...draft, priority }))
                }
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors focus:ring-2 focus:ring-brand-500/40 focus:outline-none ${form_draft.priority === priority ? PRIORITY_STYLES[priority].segmentActive : PRIORITY_SEGMENT_INACTIVE}`}
              >
                {PRIORITY_STYLES[priority].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span id="kanban-drawer-members-label" className={FIELD_LABEL_CLASS}>
            Members
          </span>
          <div
            role="group"
            aria-labelledby="kanban-drawer-members-label"
            className="flex flex-wrap gap-2"
          >
            {members.map((member) => {
              const is_assigned = form_draft.assigneeIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleMember(member.id)}
                  aria-pressed={is_assigned}
                  title={member.username}
                  className={
                    is_assigned
                      ? "rounded-full ring-2 ring-brand-500 focus:ring-2 focus:ring-brand-500/40 focus:outline-none"
                      : "rounded-full opacity-50 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-brand-500/40 focus:outline-none"
                  }
                >
                  {member.avatarUrl !== null ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.username}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${CATEGORY_COLOR_PALETTE[assigneeColorIndex(member.username)].bg}`}
                    >
                      {member.username.slice(0, 2).toUpperCase()}
                      <span className="sr-only">{member.username}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label
              htmlFor="kanban-drawer-notes"
              className="text-xs font-semibold tracking-wide text-text-secondary uppercase"
            >
              Notes
            </Label>
            <span className="shrink-0 text-xs text-text-muted">
              {form_draft.notes.length} / {TASK_NOTES_MAX_LENGTH}
            </span>
          </div>
          {/* No flex-1 here on purpose: this used to stretch to fill whatever
              vertical space the drawer happened to have, which on a tall
              screen ballooned a mostly-empty notes field to hundreds of
              pixels tall. min-h-40 keeps the original starting size; resize-y
              still lets someone grow it by hand for a genuinely long note. */}
          <Textarea
            id="kanban-drawer-notes"
            value={form_draft.notes}
            onChange={(event) =>
              setFormDraft((draft) => ({ ...draft, notes: event.target.value }))
            }
            maxLength={TASK_NOTES_MAX_LENGTH}
            placeholder={
              "## Notes\n\n- Implementation details\n- Blockers\n- References"
            }
            // surface-* tokens, not the lighter control-* ones meant for auth
            // forms. placeholder: is spelled out because
            // darkSurfaceFieldClassName sets no placeholder color and
            // Flowbite's own default would win.
            className={`min-h-40 resize-y font-mono text-sm placeholder:!text-text-muted ${darkSurfaceFieldClassName}`}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-surface-border p-4">
        <Button
          type="button"
          onClick={onClose}
          disabled={is_submitting}
          className="mr-auto border border-control-border bg-transparent! text-text-secondary! hover:bg-surface-overlay! hover:text-text-primary! focus:ring-2 focus:ring-brand-500/40 dark:focus:ring-brand-500/40 focus:outline-none! focus-visible:outline-none"
        >
          Discard
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={is_submitting}
          className="bg-brand-500 text-gray-900 hover:bg-brand-600 focus:ring-4 focus:ring-green-300 dark:bg-brand-500 dark:text-gray-900 dark:hover:bg-brand-600 dark:focus:ring-green-800"
        >
          {is_submitting
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create"
              : "Save"}
        </Button>
      </div>
    </>
  );
}
