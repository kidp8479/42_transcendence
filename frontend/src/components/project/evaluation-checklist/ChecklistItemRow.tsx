import { Avatar, Checkbox, TextInput } from "flowbite-react";
import { RiDeleteBackFill } from "react-icons/ri";
import { useFieldLock } from "@/hooks/useFieldLock";
import {
  EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH,
  type EvaluationChecklistItem,
} from "@/lib/evaluationChecklist";

interface ChecklistItemRowProps {
  item: EvaluationChecklistItem;
  projectId: string;
  currentUserId: string;
  checkedColor: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onToggle: () => void;
  onCommitLabel: (newValue: string) => void;
  onDelete: () => void;
}

// One item = one lock (keyed by the item's own id), unlike the Discovery
// block edit screen where a single lock covers the whole form - each
// checklist item is edited independently, so each needs its own hook call.
// That's the reason this is its own component: a hook can't be called
// conditionally inside the parent's .map() loop.
export function ChecklistItemRow({
  item,
  projectId,
  currentUserId,
  checkedColor,
  isEditing,
  onStartEdit,
  onStopEdit,
  onToggle,
  onCommitLabel,
  onDelete,
}: ChecklistItemRowProps) {
  const { lock, isLockedByOther, acquire, release } = useFieldLock(
    projectId,
    `checklist-item:${item.id}`,
    currentUserId
  );

  async function startEdit() {
    if (isLockedByOther) {
      return;
    }
    // the server can still refuse (someone else won the race) even though
    // isLockedByOther looked false locally - only enter edit mode once it
    // actually confirms the lock is ours
    const granted = await acquire();
    if (granted) {
      onStartEdit();
    }
  }

  function commit(newValue: string) {
    release();
    onCommitLabel(newValue);
  }

  function cancel() {
    release();
    onStopEdit();
  }

  return (
    <li className="group flex items-center gap-2.5 rounded-md py-2 pr-2 pl-4 text-text-secondary hover:border hover:border-surface-border">
      {/* checked:bg-current uses this text color as the checkmark fill. */}
      <Checkbox
        className={checkedColor}
        aria-label={item.label}
        checked={item.isChecked}
        onChange={onToggle}
      />

      {/* This edits the text:
      - cancel on ESCAPE
      - commit new text on ENTER or click out of the box */}
      {isEditing ? (
        <TextInput
          maxLength={EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH}
          className="w-full px-2 text-sm"
          aria-label={`Edit "${item.label}"`}
          defaultValue={item.label}
          autoFocus
          onBlur={(event) => {
            if (
              event.currentTarget.value.length <=
              EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH
            )
              commit(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              if (
                event.currentTarget.value.length <=
                EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH
              )
                commit(event.currentTarget.value);
            }
            if (event.key === "Escape") {
              cancel();
            }
          }}
        />
      ) : isLockedByOther && lock ? (
        <span className="flex w-full min-w-0 items-center gap-2 px-2 text-left text-sm">
          <Avatar
            img={lock.avatarUrl ?? undefined}
            placeholderInitials={lock.username.slice(0, 2).toUpperCase()}
            rounded
            size="xs"
          />
          <span className="min-w-0 wrap-break-word">{item.label}</span>
        </span>
      ) : (
        <button
          type="button"
          className="w-full min-w-0 wrap-break-word px-2 text-left text-sm"
          aria-label={`Edit "${item.label}"`}
          onDoubleClick={startEdit}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              startEdit();
            }
          }}
        >
          {item.label}
        </button>
      )}

      <button
        type="button"
        className="opacity-0 transition-opacity group-hover:opacity-50 group-focus-within:opacity-50 focus:opacity-100"
        aria-label={`Delete "${item.label}"`}
        onClick={onDelete}
      >
        <RiDeleteBackFill aria-hidden="true" className="h-5 w-5" />
      </button>
    </li>
  );
}
