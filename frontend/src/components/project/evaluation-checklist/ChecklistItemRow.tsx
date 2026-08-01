import { useEffect, useRef } from "react";
import { Checkbox, TextInput } from "flowbite-react";
import { RiDeleteBackFill } from "react-icons/ri";
import { useFieldLock } from "@/hooks/useFieldLock";
import { LockOwnerAvatar } from "@/components/LockOwnerAvatar";
import {
  EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH,
  type EvaluationChecklistItem,
} from "@/lib/evaluationChecklist";

interface ChecklistItemRowProps {
  item: EvaluationChecklistItem;
  projectId: string;
  checkedColor: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onToggle: () => void;
  // resolves to whether the save actually succeeded - the caller (this
  // component) needs that to decide whether it's safe to release the lock
  // and exit edit mode, or whether to keep both and let the user retry
  onCommitLabel: (newValue: string) => Promise<boolean>;
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
    `checklist-item:${item.id}`
  );

  // Enter calls commit() directly, which triggers onCommitLabel -> the
  // parent sets isEditing=false -> this TextInput unmounts -> the browser
  // fires a native blur on it, re-running onBlur's own commit() with the
  // same value. Guards against sending the same commit twice; reset
  // whenever a fresh edit session actually starts.
  const hasCommittedRef = useRef(false);

  async function startEdit() {
    if (isLockedByOther) {
      return;
    }
    // the server can still refuse (someone else won the race) even though
    // isLockedByOther looked false locally - only enter edit mode once it
    // actually confirms the lock is ours
    const granted = await acquire();
    if (granted) {
      hasCommittedRef.current = false;
      onStartEdit();
    }
  }

  // Holds the lock (and stays in edit mode) until the save actually
  // settles - releasing it beforehand let a second member grab the field
  // while this request was still in flight, so a slow PATCH could land
  // after theirs and silently overwrite it. On failure, the lock and the
  // user's typed value are both kept so they can see the error and retry
  // without losing their edit or the field.
  async function commit(newValue: string) {
    if (hasCommittedRef.current) {
      return;
    }
    hasCommittedRef.current = true;
    const success = await onCommitLabel(newValue);
    if (success) {
      release();
      onStopEdit();
    } else {
      hasCommittedRef.current = false;
    }
  }

  function cancel() {
    // same reasoning as commit()'s guard - Escape unmounts the TextInput
    // too, and the resulting blur would otherwise still call commit()
    // and save the value the user just chose to discard
    hasCommittedRef.current = true;
    release();
    onStopEdit();
  }

  // Defense in depth against this row's own lock silently changing hands
  // while isEditing is already true locally (e.g. this socket reconnects -
  // a backend restart, a dropped connection - and someone else grabs the
  // lock in the gap): the isEditing branch below renders a plain TextInput
  // with no lock check at all, so without this the user could keep typing
  // into a field someone else now legitimately holds.
  useEffect(() => {
    if (isEditing && isLockedByOther) {
      onStopEdit();
    }
  }, [isEditing, isLockedByOther, onStopEdit]);

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
          readOnly={isLockedByOther}
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
          <LockOwnerAvatar lock={lock} />
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
