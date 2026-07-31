import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionPanel,
  AccordionTitle,
  TextInput,
  Button,
  Checkbox,
  createTheme,
  ThemeProvider,
} from "flowbite-react";
import { FaRegStar } from "react-icons/fa";
import { useEffect, useState } from "react";
import { HiOutlineShieldCheck, HiOutlineGift, HiPlus } from "react-icons/hi";
import type { IconType } from "react-icons";
import { RiDeleteBackFill } from "react-icons/ri";
import {
  createEvaluationChecklistItem,
  deleteEvaluationChecklistItem,
  fetchEvaluationChecklistItems,
  updateEvaluationChecklistItem,
  parseEvaluationChecklistItem,
  EVALUATION_CHECKLIST_SECTIONS,
  EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH,
  EVALUATION_CHECKLIST_MAX_ITEMS_PER_CATEGORY,
  EVALUATION_CHECKLIST_CATEGORY_LABELS,
} from "@/lib/evaluationChecklist";
import type {
  EvaluationChecklistItem,
  EvaluationChecklistSection,
} from "@/lib/evaluationChecklist";
import { getRealtimeSocket } from "@/lib/realtimeSocket";

import { useSafeRouterInvalidate } from "@/hooks/useSafeRouterInvalidate";
import { useToast } from "@/hooks/useToast";

export const Route = createFileRoute(
  "/_authenticated/$projectId/evaluation-checklist"
)({
  loader: ({ params }) => fetchEvaluationChecklistItems(params.projectId),
  component: EvaluationChecklistPage,
});

const customTheme = createTheme({
  accordion: {
    root: {
      base: "divide-y divide-surface-border border-surface-border dark:divide-surface-border dark:border-surface-border",
    },
    content: {
      base: "py-5 px-5 bg-surface-raised dark:bg-surface-raised",
    },
    title: {
      // gap-4 keeps a fixed breathing room between our custom heading content
      // (which fills the row via flex-1 below) and Flowbite's own chevron -
      // without it flex-1 leaves the chevron with zero space to justify into.
      base: "gap-4 bg-surface-raised dark:bg-surface-raised",
      // The default theme's h2 heading has no width rule, so as a flex item
      // it shrinks to fit its content (the title text) instead of filling
      // the row - which pushed the progress bar right after the title
      // instead of a fixed column. flex-1 makes it fill the row so the
      // bar's justify-between reference is the same width in every accordion,
      // and its own vertical center lines up with the chevron's (both center
      // against the same row height via the button's items-center).
      heading: "flex-1 min-w-0",
      flush: {
        off: "hover:bg-surface-overlay dark:hover:bg-surface-overlay",
        on: "",
      },
      open: {
        off: "",
        on: "bg-surface-raised dark:bg-surface-raised",
      },
    },
  },
  // Subtler, low-contrast controls to match the mock: the checklist rows
  // shouldn't compete visually with the accordion headers above them.
  textInput: {
    field: {
      input: {
        colors: {
          // focus:border stays neutral gray, same as resting state - only
          // :hover gets the per-category color, added via the theme prop on
          // each <TextInput> instance. The mouse is still over the input
          // right after a click, so :hover and :focus both match at once -
          // the "!" (important) modifier is what guarantees focus wins,
          // instead of relying on which utility happens to be generated
          // later in the stylesheet. The global :focus-visible outline
          // (index.css) is dropped entirely here rather than recolored, so a
          // focused input looks identical to its resting state, as requested.
          gray: "border-surface-border bg-surface-overlay text-text-primary placeholder-text-muted focus:!border-surface-border focus:ring-0 focus-visible:!outline-none dark:border-surface-border dark:bg-surface-overlay dark:text-text-primary dark:placeholder-text-muted dark:focus:!border-surface-border dark:focus:ring-0 dark:focus-visible:!outline-none",
        },
      },
    },
  },
  checkbox: {
    base: "h-4 w-4 shrink-0 appearance-none rounded border border-surface-border bg-surface-overlay bg-[length:0.55em_0.55em] bg-center bg-no-repeat checked:border-transparent checked:bg-current checked:bg-check-icon focus:outline-none focus:ring-0 dark:border-surface-border dark:bg-surface-overlay dark:checked:border-transparent dark:checked:bg-current",
    color: {
      default: "text-brand-700 dark:text-brand-700",
    },
  },
  button: {
    color: {
      gray: "border border-surface-border bg-surface-overlay text-text-secondary hover:border-surface-border hover:bg-surface-overlay focus:ring-0 dark:border-surface-border dark:bg-surface-overlay dark:text-text-secondary dark:hover:bg-surface-overlay dark:focus:ring-0",
    },
  },
});

// Presentation-only metadata per category (icon/color/description) - the
// checklist items themselves come from the backend, this is purely display.
const CATEGORY_STYLE: Record<
  string,
  {
    icon: IconType;
    iconBg: string;
    iconText: string;
    barBg: string;
    // Written out in full (not built from iconText at runtime) so Tailwind's
    // source scanner can actually see the class and generate its CSS - see
    // the equivalent note in lib/categoryColorPalette.ts.
    addButtonHover: string;
    // :hover only - :focus/:focus-visible stay neutral gray (see the
    // textInput.field.input.colors.gray note in customTheme above).
    inputBorder: string;
    // Flowbite's default checkbox theme sets a plain "dark:text-brand-700"
    // rule, and this app's <html> always carries the "dark" class (see
    // index.html), so that dark-variant rule is always in effect and always
    // wins ties against a plain, unprefixed override. Needs its own explicit
    // "dark:" class here, not just iconText, or it silently loses to green -
    // and "!" (important) since which of two same-specificity dark: rules is
    // generated last isn't reliable (confirmed: dark:text-brand-500 actually
    // compiles *before* the default theme's dark:text-brand-700).
    checkedColor: string;
    // Applied to the accordion's own border once that category reaches 100%.
    borderColor: string;
    description?: string;
  }
> = {
  [EVALUATION_CHECKLIST_CATEGORY_LABELS.MANDATORY]: {
    icon: HiOutlineShieldCheck,
    iconBg: "bg-brand-500/15",
    iconText: "text-brand-500",
    barBg: "bg-brand-500",
    addButtonHover:
      "hover:border-brand-500 hover:text-brand-500 dark:hover:border-brand-500 dark:hover:text-brand-500",
    inputBorder: "hover:border-brand-500 dark:hover:border-brand-500",
    checkedColor: "!text-brand-500 dark:!text-brand-500",
    borderColor: "border-brand-500 dark:border-brand-500",
  },
  [EVALUATION_CHECKLIST_CATEGORY_LABELS.BONUS]: {
    icon: HiOutlineGift,
    iconBg: "bg-status-in-progress/15",
    iconText: "text-status-in-progress",
    barBg: "bg-status-in-progress",
    addButtonHover:
      "hover:border-status-in-progress hover:text-status-in-progress dark:hover:border-status-in-progress dark:hover:text-status-in-progress",
    inputBorder:
      "hover:border-status-in-progress dark:hover:border-status-in-progress",
    checkedColor: "!text-status-in-progress dark:!text-status-in-progress",
    borderColor: "border-status-in-progress dark:border-status-in-progress",
  },
  [EVALUATION_CHECKLIST_CATEGORY_LABELS.SUPPLEMENTAL]: {
    icon: FaRegStar,
    iconBg: "bg-status-review/15",
    iconText: "text-status-review",
    barBg: "bg-status-review",
    addButtonHover:
      "hover:border-status-review hover:text-status-review dark:hover:border-status-review dark:hover:text-status-review",
    inputBorder: "hover:border-status-review dark:hover:border-status-review",
    checkedColor: "!text-status-review dark:!text-status-review",
    borderColor: "border-status-review dark:border-status-review",
    description:
      "Supplemental goals are extras beyond the subject requirements. They won't affect your mandatory pass, but show evaluators you went the extra mile.",
  },
};

interface ItemCount {
  currentValue: number;
  completeAt: number;
  percent?: number;
}

interface AccordionItemData {
  title: string;
  contents: EvaluationChecklistItem[];
  count: ItemCount;
}

// Fixed [Mandatory, Bonus, Supplemental] order - CATEGORY_STYLE, sectionByIndex
// below, and every consumer of this function's result all rely on that same
// order. Derived from EVALUATION_CHECKLIST_SECTIONS (the single source of
// truth for section order) instead of being repeated here.
const SECTION_TO_ACCORDION_INDEX = Object.fromEntries(
  EVALUATION_CHECKLIST_SECTIONS.map((section, index) => [section, index])
) as Record<EvaluationChecklistSection, number>;

// Groups items by section and sorts each group by its own `order` - the
// only sort this page ever needs (checklist rows are manually ordered by
// the user, not by id/label/checked state).
function categorizeChecklistItems(
  items: EvaluationChecklistItem[]
): AccordionItemData[] {
  const accordionItemData: AccordionItemData[] = [
    {
      title: EVALUATION_CHECKLIST_CATEGORY_LABELS.MANDATORY,
      contents: [],
      count: { currentValue: 0, completeAt: 0 },
    },
    {
      title: EVALUATION_CHECKLIST_CATEGORY_LABELS.BONUS,
      contents: [],
      count: { currentValue: 0, completeAt: 0 },
    },
    {
      title: EVALUATION_CHECKLIST_CATEGORY_LABELS.SUPPLEMENTAL,
      contents: [],
      count: { currentValue: 0, completeAt: 0 },
    },
  ];

  for (const item of items) {
    const data = accordionItemData[SECTION_TO_ACCORDION_INDEX[item.section]];
    data.contents.push(item);
    data.count.completeAt += 1;
    if (item.isChecked) {
      data.count.currentValue += 1;
    }
  }

  for (const data of accordionItemData) {
    data.contents.sort((a, b) => a.order - b.order);
  }

  return accordionItemData;
}

// Generic failure toast text for the three mutations below, e.g.
// errorMessage("created") -> "Item could not be created. Please retry."
function errorMessage(arg: string) {
  return "Item could not be " + arg + ". Please retry.";
}

// Mandatory alone carries the first 100 points (READY). Bonus and Supplemental
// each unlock CATEGORY_WEIGHT further points once the previous category is
// fully done, topping the score out at EXTRA_READY.
const CATEGORY_WEIGHT = 25;
const READINESS_THRESHOLD = {
  READY: 100,
  SUPER_READY: 125,
  EXTRA_READY: 150,
} as const;

function EvaluationChecklistPage() {
  const { projectId } = Route.useParams();
  const checklistItems = Route.useLoaderData();
  const [items, setItems] = useState<EvaluationChecklistItem[]>(checklistItems);
  const accordionItemData = categorizeChecklistItems(items);
  const safeInvalidateRouter = useSafeRouterInvalidate();
  const { showToast } = useToast();

  // live sync: another member checking/unchecking an item updates this
  // page without a reload
  useEffect(() => {
    const socket = getRealtimeSocket();

    function handleItemUpdated(payload: unknown) {
      const updatedItem = parseEvaluationChecklistItem(payload);
      if (updatedItem === null) {
        return;
      }
      setItems((previous) =>
        previous.map((currentItem) =>
          currentItem.id === updatedItem.id ? updatedItem : currentItem
        )
      );
    }

    socket.on("checklist-item:updated", handleItemUpdated);
    return () => {
      socket.off("checklist-item:updated", handleItemUpdated);
    };
  }, []);

  // Plain per-category completion percent (no gating, unlike totalProgress
  // below) - used for each accordion's own progress bar.
  function categoryPercent(data: AccordionItemData): number {
    return data.count.completeAt === 0
      ? 0
      : Math.round((data.count.currentValue / data.count.completeAt) * 100);
  }

  // accordionItemData is always [Mandatory, Bonus, Supplemental], in that
  // order - see categorizeChecklistItems.
  const [mandatoryData, bonusData, supplementalData] = accordionItemData;
  const categoryPercents = accordionItemData.map(categoryPercent);
  const [mandatoryPercent, bonusPercent, supplementalPercent] =
    categoryPercents;
  const mandatoryComplete = mandatoryPercent >= READINESS_THRESHOLD.READY;
  const bonusComplete = bonusPercent >= READINESS_THRESHOLD.READY;

  // Same gating as the percent below: a category's items only join the
  // overall "X / Y" count once the previous category is fully done.
  const totalProgress: ItemCount = {
    currentValue: mandatoryData.count.currentValue,
    completeAt: mandatoryData.count.completeAt,
  };
  if (mandatoryComplete) {
    totalProgress.currentValue += bonusData.count.currentValue;
    totalProgress.completeAt += bonusData.count.completeAt;
    if (bonusComplete) {
      totalProgress.currentValue += supplementalData.count.currentValue;
      totalProgress.completeAt += supplementalData.count.completeAt;
    }
  }

  // Bonus only starts counting once Mandatory is done, and Supplemental only
  // once both Mandatory and Bonus are done - see READINESS_THRESHOLD/
  // CATEGORY_WEIGHT above for what each stage is worth.
  let overallPercent = mandatoryPercent;
  if (mandatoryComplete) {
    overallPercent += (bonusPercent / 100) * CATEGORY_WEIGHT;
    if (bonusComplete) {
      overallPercent += (supplementalPercent / 100) * CATEGORY_WEIGHT;
    }
  }
  totalProgress.percent = Math.round(overallPercent);

  const [editingId, setEditingId] = useState<string | null>(null);

  // One draft label per category (index-aligned with accordionItemData /
  // sectionByIndex below), for the "Add a defense checkpoint..." input.
  const [newItemLabels, setNewItemLabels] = useState<string[]>(
    EVALUATION_CHECKLIST_SECTIONS.map(() => "")
  );

  function setNewItemLabel(index: number, value: string) {
    setNewItemLabels((previous) =>
      previous.map((label, i) => (i === index ? value : label))
    );
  }

  const sectionByIndex: readonly EvaluationChecklistSection[] =
    EVALUATION_CHECKLIST_SECTIONS;

  // Not optimistic: the backend assigns the real id, so the new item is only
  // added to local state once the POST actually succeeds.
  async function handleCreate(dto: {
    label: string;
    section: EvaluationChecklistSection;
    order: number;
  }) {
    try {
      const created = await createEvaluationChecklistItem(projectId, dto);
      setItems((prevItems) => [...prevItems, created]);
    } catch {
      showToast({ type: "error", message: errorMessage("created") });
      // invalidate is skipped on failure - see handleUpdate/handleDelete below.
      return;
    }
    await safeInvalidateRouter();
  }

  async function handleUpdate(
    id: string,
    changes: Partial<EvaluationChecklistItem>
  ) {
    // save previous state in case rollback is needed
    const previousItem = items.find((it) => it.id === id);
    if (!previousItem) return;

    // optimistic update
    setItems((prevItems) =>
      prevItems.map((it) => (it.id === id ? { ...it, ...changes } : it))
    );

    try {
      await updateEvaluationChecklistItem(projectId, id, changes);
    } catch {
      setItems((prev) => prev.map((it) => (it.id === id ? previousItem : it)));
      showToast({ type: "error", message: errorMessage("updated") });
      return;
    }
    await safeInvalidateRouter();
  }

  // Optimistic delete: removed from the list immediately, re-inserted on
  // failure. previousItem also carries the item's own position, so
  // re-appending it doesn't guarantee its original spot in the list - fine
  // here since a failed delete is rare and the list gets re-sorted by
  // `order` on the next render anyway.
  async function handleDelete(id: string) {
    const previousItem = items.find((it) => it.id === id);
    if (!previousItem) return;

    setItems((prevItems) => prevItems.filter((it) => it.id !== id));

    try {
      await deleteEvaluationChecklistItem(projectId, id);
    } catch {
      setItems((prevItems) => [...prevItems, previousItem]);
      showToast({ type: "error", message: errorMessage("deleted") });
      return;
    }
    await safeInvalidateRouter();
  }

  // "Ready"/"Super Ready"/"Extra Ready" badge shown at the top of the page,
  // one tier per READINESS_THRESHOLD crossed.
  const readinessLabel =
    totalProgress.percent >= READINESS_THRESHOLD.EXTRA_READY
      ? "Extra Ready"
      : totalProgress.percent >= READINESS_THRESHOLD.SUPER_READY
        ? "Super Ready"
        : totalProgress.percent >= READINESS_THRESHOLD.READY
          ? "Ready"
          : "Not ready yet";

  // Each milestone borrows the color of the category that unlocked it.
  const readinessColor =
    totalProgress.percent >= READINESS_THRESHOLD.EXTRA_READY
      ? CATEGORY_STYLE[EVALUATION_CHECKLIST_CATEGORY_LABELS.SUPPLEMENTAL]
          .iconText
      : totalProgress.percent >= READINESS_THRESHOLD.SUPER_READY
        ? CATEGORY_STYLE[EVALUATION_CHECKLIST_CATEGORY_LABELS.BONUS].iconText
        : totalProgress.percent >= READINESS_THRESHOLD.READY
          ? CATEGORY_STYLE[EVALUATION_CHECKLIST_CATEGORY_LABELS.MANDATORY]
              .iconText
          : "text-text-secondary";

  // Overall progress bar: solid mandatory color up to 100%, bonus color from
  // 100% to 125%, supplemental color beyond that - same tiers as
  // readinessLabel/readinessColor above, just applied to the fill itself
  // instead of the badge.
  const overallBarBg =
    totalProgress.percent > READINESS_THRESHOLD.SUPER_READY
      ? CATEGORY_STYLE[EVALUATION_CHECKLIST_CATEGORY_LABELS.SUPPLEMENTAL].barBg
      : totalProgress.percent > READINESS_THRESHOLD.READY
        ? CATEGORY_STYLE[EVALUATION_CHECKLIST_CATEGORY_LABELS.BONUS].barBg
        : CATEGORY_STYLE[EVALUATION_CHECKLIST_CATEGORY_LABELS.MANDATORY].barBg;

  // Same tiers as overallBarBg, applied to the "X / Y — Z%" stat text next to
  // the "Overall progress" heading so it always matches the bar's color.
  const overallTextColor =
    totalProgress.percent > READINESS_THRESHOLD.SUPER_READY
      ? CATEGORY_STYLE[EVALUATION_CHECKLIST_CATEGORY_LABELS.SUPPLEMENTAL]
          .iconText
      : totalProgress.percent > READINESS_THRESHOLD.READY
        ? CATEGORY_STYLE[EVALUATION_CHECKLIST_CATEGORY_LABELS.BONUS].iconText
        : CATEGORY_STYLE[EVALUATION_CHECKLIST_CATEGORY_LABELS.MANDATORY]
            .iconText;

  return (
    <div className="w-full space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-text-secondary">
          Track your own defense checklist so you know exactly what to review
          before the correction.
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm font-medium">
          <HiOutlineShieldCheck
            aria-hidden="true"
            className={`h-5 w-5 ${readinessColor}`}
          />
          <span className={readinessColor}>{readinessLabel}</span>
        </div>
      </section>
      <section
        aria-labelledby="overall-progress-heading"
        className="rounded-lg border border-surface-border bg-surface-raised p-4"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="overall-progress-heading"
            className="font-mono text-base font-semibold text-text-primary"
          >
            Overall progress
          </h2>
          <span className="text-sm">
            <span className={`font-bold ${overallTextColor}`}>
              {totalProgress.currentValue}
            </span>
            <span className="text-text-secondary">
              {" "}
              / {totalProgress.completeAt} —{" "}
            </span>
            <span className={`font-bold ${overallTextColor}`}>
              {totalProgress.percent}%
            </span>
          </span>
        </div>
        <div
          className="relative h-2 w-full rounded-full bg-surface-overlay"
          role="progressbar"
          aria-valuenow={totalProgress.percent}
          aria-valuemin={0}
          aria-valuemax={READINESS_THRESHOLD.EXTRA_READY}
          aria-labelledby="overall-progress-heading"
        >
          <div
            className={`h-2 rounded-full transition-colors ${overallBarBg}`}
            style={{
              width: `${Math.min((totalProgress.percent / READINESS_THRESHOLD.EXTRA_READY) * 100, 100)}%`,
            }}
          />
          {/* Tick marks for the 100/125% readiness thresholds only - 150% gets
          a label below but no tick line here, it's the bar's own max, not an
          in-between mark. Plain UI gray, they don't track which category is
          currently active (the fill color already does that). Their labels
          live in the row below instead of right under the tick, so they line
          up with "Defense day". */}
          {[READINESS_THRESHOLD.READY, READINESS_THRESHOLD.SUPER_READY].map(
            (threshold) => (
              <div
                key={threshold}
                className="absolute top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-text-muted/60"
                style={{
                  left: `${(threshold / READINESS_THRESHOLD.EXTRA_READY) * 100}%`,
                }}
              />
            )
          )}
        </div>
        <div className="relative mt-2 flex items-center justify-between text-xs text-text-muted">
          {[
            READINESS_THRESHOLD.READY,
            READINESS_THRESHOLD.SUPER_READY,
            READINESS_THRESHOLD.EXTRA_READY,
          ].map((threshold) => (
            <span
              key={threshold}
              className="absolute -translate-x-1/2 text-text-muted/70"
              style={{
                left: `${(threshold / READINESS_THRESHOLD.EXTRA_READY) * 100}%`,
              }}
            >
              {threshold}%
            </span>
          ))}
        </div>
      </section>
      <div className="space-y-4">
        {accordionItemData.map((item, i) => {
          const style = CATEGORY_STYLE[item.title];
          const categoryPercent = categoryPercents[i];
          const isCategoryComplete = categoryPercent >= 100;
          const isCategoryFull =
            item.contents.length >= EVALUATION_CHECKLIST_MAX_ITEMS_PER_CATEGORY;

          // Reads this category's draft label, submits it as a new item, then
          // clears the draft - order is just "append at the end" (current
          // length), the cap is re-checked defensively even though the "Add"
          // button is already disabled once isCategoryFull is true.
          function addChecklistItem() {
            const label = newItemLabels[i].trim();
            if (
              label.length === 0 ||
              item.contents.length >=
                EVALUATION_CHECKLIST_MAX_ITEMS_PER_CATEGORY
            ) {
              return;
            }

            const nextOrder =
              item.contents.reduce((max, it) => Math.max(max, it.order), -1) +
              1;

            handleCreate({
              label,
              order: nextOrder,
              section: sectionByIndex[i],
            });
            setNewItemLabel(i, "");
          }
          return (
            <ThemeProvider key={item.title} theme={customTheme}>
              <Accordion
                className={`overflow-hidden rounded-lg border ${isCategoryComplete ? style.borderColor : "border-surface-border"}`}
              >
                <AccordionPanel>
                  <AccordionTitle className="font-mono">
                    <div className="flex w-full items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${style.iconBg}`}
                        >
                          <style.icon
                            aria-hidden="true"
                            className={`h-5 w-5 ${style.iconText}`}
                          />
                        </span>
                        <span className="text-left">
                          <span className="block font-mono text-base font-semibold text-text-primary">
                            {item.title}
                          </span>
                          <span className="block text-xs text-text-secondary">
                            {item.count.currentValue}/{item.count.completeAt}{" "}
                            completed
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className="h-1.5 w-24 rounded-full bg-surface-overlay"
                          role="progressbar"
                          aria-valuenow={categoryPercent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${item.title} progress`}
                        >
                          <div
                            className={`h-1.5 rounded-full ${style.barBg}`}
                            style={{ width: `${categoryPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-secondary">
                          {categoryPercent}%
                        </span>
                      </div>
                    </div>
                  </AccordionTitle>

                  <AccordionContent>
                    <ul>
                      {item.contents.map((c) => {
                        // Only fires the PATCH if the label actually changed
                        // and isn't blank - either way, exits edit mode.
                        function commitLabel(newValue: string) {
                          if (newValue.trim().length && newValue !== c.label) {
                            handleUpdate(c.id, { label: newValue });
                          }
                          setEditingId(null);
                        }

                        return (
                          <li
                            key={c.id}
                            className="group flex items-center gap-2.5 rounded-md py-2 pr-2 pl-4 text-text-secondary hover:border hover:border-surface-border"
                          >
                            {/* checked:bg-current uses this text color as the
                          checkmark fill. */}
                            <Checkbox
                              className={style.checkedColor}
                              aria-label={c.label}
                              checked={c.isChecked}
                              onChange={() =>
                                handleUpdate(c.id, { isChecked: !c.isChecked })
                              }
                            />

                            {/* This edits the text:
                            - cancel on ESCAPE
                            - commit new text on ENTER or click out of the box                    */}
                            {editingId === c.id ? (
                              <TextInput
                                maxLength={
                                  EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH
                                }
                                className="w-full px-2 text-sm"
                                aria-label={`Edit "${c.label}"`}
                                defaultValue={c.label}
                                autoFocus
                                onBlur={(e) => {
                                  if (
                                    e.currentTarget.value.length <=
                                    EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH
                                  )
                                    commitLabel(e.currentTarget.value);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    if (
                                      e.currentTarget.value.length <=
                                      EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH
                                    )
                                      commitLabel(e.currentTarget.value);
                                  }
                                  if (e.key === "Escape") {
                                    setEditingId(null);
                                  }
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                className="w-full min-w-0 wrap-break-word px-2 text-left text-sm"
                                aria-label={`Edit "${c.label}"`}
                                onDoubleClick={() => setEditingId(c.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setEditingId(c.id);
                                  }
                                }}
                              >
                                {c.label}
                              </button>
                            )}

                            <button
                              type="button"
                              className="opacity-0 transition-opacity group-hover:opacity-50 group-focus-within:opacity-50 focus:opacity-100"
                              aria-label={`Delete "${c.label}"`}
                              onClick={() => handleDelete(c.id)}
                            >
                              <RiDeleteBackFill
                                aria-hidden="true"
                                className="h-5 w-5"
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-5 flex items-center gap-3">
                      <TextInput
                        className="flex-1"
                        type="text"
                        aria-label={`Add a defense checkpoint to ${item.title}`}
                        placeholder={
                          isCategoryFull
                            ? `Limit of ${EVALUATION_CHECKLIST_MAX_ITEMS_PER_CATEGORY} items reached`
                            : "Add a defense checkpoint..."
                        }
                        required
                        disabled={isCategoryFull}
                        maxLength={EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH}
                        value={newItemLabels[i]}
                        onChange={(e) => setNewItemLabel(i, e.target.value)}
                        // className only reaches TextInput's outer wrapper, not the
                        // <input> itself, so the per-category hover/focus border has
                        // to go through the theme prop (merged onto field.input.colors.gray).
                        theme={{
                          field: {
                            input: { colors: { gray: style.inputBorder } },
                          },
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addChecklistItem();
                        }}
                      />
                      <Button
                        color="gray"
                        className={style.addButtonHover}
                        disabled={
                          isCategoryFull || newItemLabels[i].trim().length === 0
                        }
                        onClick={addChecklistItem}
                      >
                        <HiPlus aria-hidden="true" className="mr-1 h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionPanel>
              </Accordion>
            </ThemeProvider>
          );
        })}
      </div>

      {/* bottom advice */}
      {accordionItemData
        .filter((item) => CATEGORY_STYLE[item.title]?.description)
        .map((item) => (
          <div
            key={item.title}
            className="flex items-start gap-2 rounded-lg border border-surface-border bg-surface-raised p-4 text-sm text-text-secondary"
          >
            <FaRegStar
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-status-review"
            />
            <p>
              <span className="font-semibold text-text-primary">
                {item.title}
              </span>{" "}
              {CATEGORY_STYLE[item.title]?.description}
            </p>
          </div>
        ))}
    </div>
  );
}
