// Detail drawer for a kanban card.
// Opens when the user clicks a card on the Kanban board (edit mode) or one of
// the board's "+" buttons (create mode, preset to that column's status).
// Renders its content inside DrawerShell (which owns the click-catcher,
// Escape, slide-in and resizing) and owns the fullscreen toggle state the
// shell needs. Both the drawer and its fullscreen mode are confined to the
// Kanban work area - see DrawerShell's own header.
//
// Displays and edits the task fields the board shows: title, status,
// category, priority, members, notes. The component is a controlled form over
// a TaskDraft; submitting hands the draft up - the route decides whether that
// means create or update. The parent remounts this component per task (key
// prop), which is what initializes the form, so no state-syncing effects.
//
// Fields intentionally NOT here yet (absent from the design mockup):
// startAt/endAt, description, onCalendar - the route fills create defaults
// and preserves those fields on edit. Revisit with the Calendar tab.
import { useState } from "react";
import { Button, Label, Textarea } from "flowbite-react";
import { HiOutlineArrowsExpand, HiOutlineX } from "react-icons/hi";
import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";
import { darkSurfaceFieldClassName } from "@/lib/flowbite";
import {
  PRIORITY_ORDER,
  PRIORITY_SEGMENT_INACTIVE,
  PRIORITY_STYLES,
} from "@/lib/taskPriorityStyles";
import { STATUS_ORDER, STATUS_STYLES } from "@/lib/taskStatusStyles";
import type { Task, TaskPriority, TaskStatus } from "@/lib/tasks";
import type { TaskCategory } from "@/lib/taskCategories";
import type { ProjectMemberUser } from "@/lib/projectMembers";
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

interface KanBanCardDrawerProps {
  mode: "create" | "edit";
  // the task being edited; null in create mode
  task: Task | null;
  // status column whose "+" was clicked (create mode's preset)
  initialStatus: TaskStatus;
  categories: TaskCategory[];
  members: ProjectMemberUser[];
  onClose: () => void;
  onSubmit: (draft: TaskDraft) => void;
  // panel width, owned by the route so it survives this component's remounts
  width: number;
  minWidth: number;
  maxWidth: number;
  onWidthChange: (width: number) => void;
}

const DRAWER_HEADING_ID = "kanban-card-drawer-heading";

// Field labels: same uppercase micro-label as the Discovery edit screen, with
// the column width this drawer's two-column rows need.
const FIELD_LABEL_CLASS =
  "w-24 shrink-0 text-xs font-semibold tracking-wide text-text-secondary uppercase";

const ICON_BUTTON_CLASS =
  "rounded-md p-1.5 text-text-secondary hover:bg-surface-overlay hover:text-text-primary focus:ring-2 focus:ring-brand-500/40 focus:outline-none";

export function KanBanCardDrawer({
  mode,
  task,
  initialStatus,
  categories,
  members,
  onClose,
  onSubmit,
  width,
  minWidth,
  maxWidth,
  onWidthChange,
}: KanBanCardDrawerProps) {
  const [is_fullscreen, setIsFullscreen] = useState(false);
  // Validation messages only appear after a failed submit attempt, not while
  // the user is still filling the form in.
  const [show_errors, setShowErrors] = useState(false);

  const [form_draft, setFormDraft] = useState<TaskDraft>(() =>
    task !== null
      ? {
          title: task.title,
          categoryId: task.categoryId,
          status: task.status,
          priority: task.priority,
          assigneeIds: task.assignees.map((assignee) => assignee.id),
          notes: task.notes ?? "",
        }
      : {
          title: "",
          categoryId: null,
          status: initialStatus,
          priority: "MEDIUM",
          assigneeIds: [],
          notes: "",
        }
  );

  const selected_category =
    form_draft.categoryId !== null
      ? (categories.find((category) => category.id === form_draft.categoryId) ??
        null)
      : null;
  // Same out-of-range fallback as everywhere else in the palette's consumers.
  const selected_category_color =
    selected_category !== null
      ? (CATEGORY_COLOR_PALETTE[selected_category.color] ??
        CATEGORY_COLOR_PALETTE[0])
      : null;

  const title_error = show_errors && form_draft.title.trim() === "";
  const category_error = show_errors && form_draft.categoryId === null;

  function handleSubmit() {
    if (form_draft.title.trim() === "" || form_draft.categoryId === null) {
      setShowErrors(true);
      return;
    }
    onSubmit({ ...form_draft, title: form_draft.title.trim() });
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
    <DrawerShell
      onClose={onClose}
      isFullscreen={is_fullscreen}
      labelledBy={DRAWER_HEADING_ID}
      width={width}
      minWidth={minWidth}
      maxWidth={maxWidth}
      onWidthChange={onWidthChange}
    >
      <h2 id={DRAWER_HEADING_ID} className="sr-only">
        {mode === "create" ? "Create task" : `Edit task ${task?.title ?? ""}`}
      </h2>

      {/* Accent bar - the selected category's color, live. */}
      <div
        aria-hidden="true"
        className={`h-1 w-full shrink-0 ${selected_category_color !== null ? selected_category_color.bg : "bg-surface-border"}`}
      />

      <div className="flex shrink-0 items-center gap-2 border-b border-surface-border p-4">
        <TaskCategoryBadge category={selected_category} />
        <TaskPriorityDot priority={form_draft.priority} />
        {/* Cosmetic reference only: tasks have no human-readable number, so
            edit mode shows the start of the id (first uuid segment once real
            ids exist). A real task number needs backend support. */}
        <span className="font-mono text-xs text-text-muted">
          {mode === "edit" && task !== null
            ? `#${task.id.slice(0, 8)}`
            : "New task"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsFullscreen((previous) => !previous)}
            aria-pressed={is_fullscreen}
            aria-label={
              is_fullscreen ? "Exit fullscreen" : "Expand to fullscreen"
            }
            title={is_fullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
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

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        <div>
          <input
            type="text"
            value={form_draft.title}
            onChange={(event) =>
              setFormDraft((draft) => ({ ...draft, title: event.target.value }))
            }
            placeholder="Task title"
            aria-label="Task title"
            className="w-full bg-transparent font-mono text-lg font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {title_error && (
            <p className="mt-1 text-xs text-control-error">Title is required</p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Label htmlFor="kanban-drawer-status" className={FIELD_LABEL_CLASS}>
            Status
          </Label>
          {/* Native selects here on purpose: their whole point is carrying the
              live status/category tint, which a Flowbite Select theme would
              fight. Tinted with the same literals as the column count pills. */}
          <select
            id="kanban-drawer-status"
            value={form_draft.status}
            onChange={(event) =>
              setFormDraft((draft) => ({
                ...draft,
                status: event.target.value as TaskStatus,
              }))
            }
            className={`rounded-lg border px-3 py-1.5 text-sm ${STATUS_STYLES[form_draft.status].countBadge}`}
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
          <div
            role="radiogroup"
            aria-labelledby="kanban-drawer-priority-label"
            className="flex gap-2"
          >
            {PRIORITY_ORDER.map((priority) => (
              <button
                key={priority}
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

        <div className="flex flex-1 flex-col gap-2">
          <Label
            htmlFor="kanban-drawer-notes"
            className="text-xs font-semibold tracking-wide text-text-secondary uppercase"
          >
            Notes
          </Label>
          <Textarea
            id="kanban-drawer-notes"
            value={form_draft.notes}
            onChange={(event) =>
              setFormDraft((draft) => ({ ...draft, notes: event.target.value }))
            }
            placeholder={
              "## Notes\n\n- Implementation details\n- Blockers\n- References"
            }
            // surface-* tokens, not the lighter control-* ones meant for auth
            // forms. placeholder: is spelled out because
            // darkSurfaceFieldClassName sets no placeholder color and
            // Flowbite's own default would win.
            className={`min-h-40 flex-1 resize-y font-mono text-sm placeholder:!text-text-muted ${darkSurfaceFieldClassName}`}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-surface-border p-4">
        <Button
          type="button"
          onClick={onClose}
          className="mr-auto border border-control-border bg-transparent! text-text-secondary! hover:bg-surface-overlay! hover:text-text-primary! focus:ring-2 focus:ring-brand-500/40 focus:outline-none! focus-visible:outline-none"
        >
          Discard
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          className="bg-brand-500 text-gray-900 hover:bg-brand-600 focus:ring-4 focus:ring-green-300 dark:bg-brand-500 dark:text-gray-900 dark:hover:bg-brand-600 dark:focus:ring-green-800"
        >
          {mode === "create" ? "Create" : "Save"}
        </Button>
      </div>
    </DrawerShell>
  );
}
