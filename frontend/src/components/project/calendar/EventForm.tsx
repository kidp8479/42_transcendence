// Create/edit form for a calendar event, rendered inside CalendarEventDrawer.
// Date and time are separate inputs in the UI but combine into a single
// startAt/endAt before saving (see handleSave).
//
// No label creation/color editing here: labels are a fixed, pre-seeded set
// per project - managing them belongs to Project Settings, not this form.
import { useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  Button,
  Datepicker,
  Dropdown,
  DropdownItem,
  Label,
  TextInput,
  Textarea,
  WeekStart,
} from "flowbite-react";
import { HiChevronDown, HiOutlineTrash } from "react-icons/hi";
import {
  darkDatepickerTheme,
  darkDatepickerThemeAlignRight,
  darkDropdownTheme,
  darkSurfaceFieldClassName,
  darkSurfaceTextInputTheme,
} from "@/lib/flowbite";
import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";
import type { CalendarCategory } from "@/lib/calendarCategoriesApi";
import {
  CALENDAR_EVENT_NOTES_MAX_LENGTH,
  CALENDAR_EVENT_TITLE_MAX_LENGTH,
  type CalendarEvent,
  type CalendarEventInput,
} from "@/lib/calendarEventsApi";
import type { ProjectMember } from "@/lib/projectMembersApi";

interface EventFormProps {
  mode: "create" | "edit";
  initialDate?: Dayjs;
  event?: CalendarEvent;
  categories: CalendarCategory[];
  members: ProjectMember[];
  onSave: (input: CalendarEventInput) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  onDiscard: () => void;
}

export function EventForm({
  mode,
  initialDate,
  event,
  categories,
  members,
  onSave,
  onDelete,
  onDiscard,
}: EventFormProps) {
  const startAnchor = event ? dayjs(event.startAt) : (initialDate ?? dayjs());
  const endAnchor = event ? dayjs(event.endAt) : startAnchor.add(1, "hour");

  const [title, setTitle] = useState(event?.title ?? "");
  const [startDate, setStartDate] = useState(startAnchor.format("YYYY-MM-DD"));
  const [startTime, setStartTime] = useState(startAnchor.format("HH:mm"));
  const [endDate, setEndDate] = useState(endAnchor.format("YYYY-MM-DD"));
  const [endTime, setEndTime] = useState(endAnchor.format("HH:mm"));
  const [categoryId, setCategoryId] = useState(
    event?.categoryId ?? categories[0]?.id ?? ""
  );
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    event?.assignees.map((assignee) => assignee.id) ?? []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedCategory = categories.find(
    (category) => category.id === categoryId
  );

  function toggleAssignee(userId: string) {
    setAssigneeIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId]
    );
  }

  async function handleSave() {
    setFormError(null);
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      setFormError("Title is required.");
      return;
    }
    if (categoryId.length === 0) {
      setFormError("A label is required.");
      return;
    }

    const startAt = dayjs(startDate + "T" + startTime);
    const endAt = dayjs(endDate + "T" + endTime);
    if (endAt.isBefore(startAt)) {
      setFormError("End date/time must be after the start.");
      return;
    }

    setIsSaving(true);
    try {
      const saved = await onSave({
        title: trimmedTitle,
        categoryId: categoryId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        description: event?.description ?? undefined,
        notes: notes.trim().length > 0 ? notes.trim() : undefined,
        assigneeIds: assigneeIds,
      });
      if (!saved) {
        setFormError("Failed to save the event.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-10 p-6">
      <div>
        <Label
          htmlFor="event-title"
          className="text-xs font-semibold tracking-wide text-text-secondary uppercase"
        >
          Title
        </Label>
        <TextInput
          id="event-title"
          autoFocus
          maxLength={CALENDAR_EVENT_TITLE_MAX_LENGTH}
          value={title}
          onChange={(changeEvent) => setTitle(changeEvent.target.value)}
          theme={darkSurfaceTextInputTheme}
          placeholder="Event title"
        />
      </div>

      <div>
        <Label className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
          Label
        </Label>
        <Dropdown
          arrowIcon={false}
          inline
          placement="bottom-start"
          theme={darkDropdownTheme}
          className="mt-1 w-56 border-solid dark:border-solid"
          renderTrigger={() => {
            const triggerColor =
              CATEGORY_COLOR_PALETTE[selectedCategory?.color ?? 0] ??
              CATEGORY_COLOR_PALETTE[0];
            return (
              <button
                type="button"
                className={
                  "mt-1 flex w-full items-center justify-between rounded-lg border p-2.5 text-sm " +
                  darkSurfaceFieldClassName
                }
              >
                <span className="flex items-center gap-2">
                  {selectedCategory && (
                    <span
                      className={"h-2.5 w-2.5 rounded-full " + triggerColor.bg}
                      aria-hidden="true"
                    ></span>
                  )}
                  {selectedCategory?.name ?? "No labels yet"}
                </span>
                <HiChevronDown className="h-4 w-4 text-text-secondary" />
              </button>
            );
          }}
        >
          {categories.map((category) => {
            const itemColor =
              CATEGORY_COLOR_PALETTE[category.color] ??
              CATEGORY_COLOR_PALETTE[0];
            return (
              <DropdownItem
                key={category.id}
                onClick={() => setCategoryId(category.id)}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={"h-2.5 w-2.5 rounded-full " + itemColor.bg}
                    aria-hidden="true"
                  ></span>
                  {category.name}
                </span>
              </DropdownItem>
            );
          })}
        </Dropdown>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label
            htmlFor="event-start-date"
            className="text-xs font-semibold tracking-wide text-text-secondary uppercase"
          >
            Start date
          </Label>
          <Datepicker
            id="event-start-date"
            weekStart={WeekStart.Monday}
            value={dayjs(startDate).toDate()}
            onChange={(date) => {
              if (date) {
                setStartDate(dayjs(date).format("YYYY-MM-DD"));
              }
            }}
            theme={{
              ...darkDatepickerTheme,
              root: { input: darkSurfaceTextInputTheme },
            }}
            className="mt-1"
          />
        </div>
        <div>
          <Label
            htmlFor="event-end-date"
            className="text-xs font-semibold tracking-wide text-text-secondary uppercase"
          >
            End date
          </Label>
          <Datepicker
            id="event-end-date"
            weekStart={WeekStart.Monday}
            value={dayjs(endDate).toDate()}
            onChange={(date) => {
              if (date) {
                setEndDate(dayjs(date).format("YYYY-MM-DD"));
              }
            }}
            theme={{
              ...darkDatepickerThemeAlignRight,
              root: { input: darkSurfaceTextInputTheme },
            }}
            className="mt-1"
          />
        </div>
        <div>
          <Label
            htmlFor="event-start-time"
            className="text-xs font-semibold tracking-wide text-text-secondary uppercase"
          >
            Start time
          </Label>
          <input
            id="event-start-time"
            type="time"
            value={startTime}
            onChange={(changeEvent) => setStartTime(changeEvent.target.value)}
            className={
              "mt-1 block w-full rounded-lg border p-2.5 text-sm " +
              darkSurfaceFieldClassName
            }
          />
        </div>
        <div>
          <Label
            htmlFor="event-end-time"
            className="text-xs font-semibold tracking-wide text-text-secondary uppercase"
          >
            End time
          </Label>
          <input
            id="event-end-time"
            type="time"
            value={endTime}
            onChange={(changeEvent) => setEndTime(changeEvent.target.value)}
            className={
              "mt-1 block w-full rounded-lg border p-2.5 text-sm " +
              darkSurfaceFieldClassName
            }
          />
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
          Members
        </Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {members.map((member) => {
            const isSelected = assigneeIds.includes(member.userId);
            return (
              <button
                key={member.userId}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleAssignee(member.userId)}
                title={member.user.username}
                className={
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white " +
                  (isSelected
                    ? "bg-brand-500 ring-2 ring-brand-500 ring-offset-2 ring-offset-surface-raised"
                    : "bg-control-bg opacity-60 hover:opacity-100")
                }
              >
                {member.user.username.slice(0, 2).toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label
          htmlFor="event-notes"
          className="text-xs font-semibold tracking-wide text-text-secondary uppercase"
        >
          Notes
        </Label>
        <Textarea
          id="event-notes"
          rows={4}
          maxLength={CALENDAR_EVENT_NOTES_MAX_LENGTH}
          value={notes}
          onChange={(changeEvent) => setNotes(changeEvent.target.value)}
          className={darkSurfaceFieldClassName}
          placeholder="Add your detailed notes here..."
        />
      </div>

      {formError && <p className="text-sm text-control-error">{formError}</p>}

      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSave()}
          className="flex-1 bg-brand-500 !text-black hover:bg-brand-600 focus:outline-none focus-visible:outline-none focus:ring-4 focus:ring-green-300 dark:bg-brand-500 dark:hover:bg-brand-600 dark:focus:ring-green-800"
        >
          {isSaving
            ? "Saving..."
            : mode === "create"
              ? "Create"
              : "Save changes"}
        </Button>
        <Button
          type="button"
          disabled={isSaving}
          onClick={onDiscard}
          className="flex-1 border border-control-border bg-transparent! text-text-secondary! hover:bg-surface-overlay! hover:text-text-primary! focus:outline-none! focus-visible:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          Discard
        </Button>
      </div>
      {mode === "edit" && onDelete && (
        <Button
          type="button"
          disabled={isDeleting}
          onClick={() => void handleDelete()}
          className="border border-control-error bg-transparent! text-control-error! hover:bg-red-950! focus:outline-none! focus-visible:outline-none focus:ring-2 focus:ring-red-500/40"
        >
          <HiOutlineTrash className="mr-1.5 h-4 w-4" />
          {isDeleting ? "Deleting..." : "Delete event"}
        </Button>
      )}
    </div>
  );
}
