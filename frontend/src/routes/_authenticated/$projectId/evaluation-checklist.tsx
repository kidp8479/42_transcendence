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
import { useState } from "react";
import { HiOutlineShieldCheck, HiOutlineGift, HiPlus } from "react-icons/hi";
import type { IconType } from "react-icons";
import { RiDeleteBackFill } from "react-icons/ri";
import {
  createEvaluationChecklistItem,
  deleteEvaluationChecklistItem,
  EvaluationChecklistItem,
  EvaluationChecklistSection,
  fetchEvaluationChecklistItems,
  updateEvaluationChecklistItem,
} from "@/lib/evaluationChecklist";

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

export const EVALUATION_CHECKLIST_ITEM_MAX_LENGTH = 350;
export const EVALUATION_CHECKLIST_MAX_ITEMS_PER_CATEGORY = 50;

// Presentation-only metadata per category (icon/color/description), kept
// separate from mockData since none of this is real backend data yet.
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
  "Mandatory Part": {
    icon: HiOutlineShieldCheck,
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
  Bonus: {
    icon: HiOutlineGift,
    iconBg: "bg-brand-500/15",
    iconText: "text-brand-500",
    barBg: "bg-brand-500",
    addButtonHover:
      "hover:border-brand-500 hover:text-brand-500 dark:hover:border-brand-500 dark:hover:text-brand-500",
    inputBorder: "hover:border-brand-500 dark:hover:border-brand-500",
    checkedColor: "!text-brand-500 dark:!text-brand-500",
    borderColor: "border-brand-500 dark:border-brand-500",
  },
  "Supplemental Goals": {
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

export interface ItemCount {
  currentValue: number;
  completeAt: number;
  percent?: number | null;
}

export interface AccordionItemData {
  title: string;
  contents: EvaluationChecklistItem[];
  count: ItemCount;
}

enum ChecklistItemSortOption {
  SORT_ON_ID,
  SORT_ON_LABEL,
  SORT_ON_ISCHECKED,
  SORT_ON_ORDER,
  SORT_ON_SECTION,
}

function categorizeChecklistItems(
  items: EvaluationChecklistItem[],
  sortOn?: ChecklistItemSortOption | null
) {
  let accordionItemData: AccordionItemData[] = [
    {
      title: "Mandatory Part",
      contents: [],
      count: { currentValue: 0, completeAt: 0 },
    },
    {
      title: "Bonus",
      contents: [],
      count: { currentValue: 0, completeAt: 0 },
    },
    {
      title: "Supplemental Goals",
      contents: [],
      count: { currentValue: 0, completeAt: 0 },
    },
  ];

  for (const item of items) {
    if (item.section === "MANDATORY") {
      accordionItemData[0].contents.push(item);
      ++accordionItemData[0].count.completeAt;
      if (item.isChecked) {
        ++accordionItemData[0].count.currentValue;
      }
    } else if (item.section === "BONUS") {
      accordionItemData[1].contents.push(item);
      ++accordionItemData[1].count.completeAt;
      if (item.isChecked) {
        ++accordionItemData[1].count.currentValue;
      }
    } else {
      accordionItemData[2].contents.push(item);
      ++accordionItemData[2].count.completeAt;
      if (item.isChecked) {
        ++accordionItemData[2].count.currentValue;
      }
    }
  }

  switch (sortOn) {
    case ChecklistItemSortOption.SORT_ON_ID:
      for (const item of accordionItemData)
        item.contents.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      break;

    case ChecklistItemSortOption.SORT_ON_LABEL:
      for (const item of accordionItemData)
        item.contents.sort((a, b) =>
          a.label < b.label ? -1 : a.label > b.label ? 1 : 0
        );
      break;

    case ChecklistItemSortOption.SORT_ON_ISCHECKED:
      for (const item of accordionItemData)
        item.contents.sort((a, b) =>
          a.isChecked < b.isChecked ? -1 : a.isChecked > b.isChecked ? 1 : 0
        );
      break;

    case ChecklistItemSortOption.SORT_ON_ORDER:
      for (const item of accordionItemData)
        item.contents.sort((a, b) =>
          a.order < b.order ? -1 : a.order > b.order ? 1 : 0
        );
      break;

    case ChecklistItemSortOption.SORT_ON_SECTION:
      for (const item of accordionItemData)
        item.contents.sort((a, b) =>
          a.section < b.section ? -1 : a.section > b.section ? 1 : 0
        );
      break;
  }

  return accordionItemData;
}

function EvaluationChecklistPage() {
  const { session } = Route.useRouteContext();
  const { projectId } = Route.useParams();
  const checklistItems = Route.useLoaderData();
  const [items, setItems] = useState<EvaluationChecklistItem[]>(checklistItems);
  const accordionItemData = categorizeChecklistItems(
    items,
    ChecklistItemSortOption.SORT_ON_ORDER
  );

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
  const mandatoryComplete = mandatoryPercent >= 100;
  const bonusComplete = bonusPercent >= 100;

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

  // Mandatory alone carries the first 100 points. Bonus only starts counting
  // once Mandatory is done (worth up to another 25), and Supplemental only
  // once both Mandatory and Bonus are done (worth a final 25) - so the score
  // tops out at 150.
  let overallPercent = mandatoryPercent;
  if (mandatoryComplete) {
    overallPercent += (bonusPercent / 100) * 25;
    if (bonusComplete) {
      overallPercent += (supplementalPercent / 100) * 25;
    }
  }
  totalProgress.percent = Math.round(overallPercent);

  const [editingId, setEditingId] = useState<string | null>(null);

  const sectionByIndex: EvaluationChecklistSection[] = [
    "MANDATORY",
    "BONUS",
    "SUPPLEMENTAL",
  ];

  async function createItem(dto: {
    label: string;
    section: EvaluationChecklistSection;
    order: number;
  }) {
    try {
      const created = await createEvaluationChecklistItem(
        projectId,
        dto,
        session.csrfToken
      );
      setItems((prevItems) => [...prevItems, created]);
    } catch {
      return;
    }
  }

  async function updateItem(
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
      await updateEvaluationChecklistItem(
        projectId,
        id,
        changes,
        session.csrfToken
      );
    } catch {
      setItems((prev) => prev.map((it) => (it.id === id ? previousItem : it)));
    }
  }

  async function deleteItem(id: string) {
    const previousItem = items.find((it) => it.id === id);
    if (!previousItem) return;

    setItems((prevItems) => prevItems.filter((it) => it.id !== id));

    try {
      await deleteEvaluationChecklistItem(projectId, id, session.csrfToken);
    } catch {
      setItems((prevItems) => [...prevItems, previousItem]);
    }
  }

  const readinessLabel =
    totalProgress.percent >= 150
      ? "Extra Ready"
      : totalProgress.percent >= 125
        ? "Super Ready"
        : totalProgress.percent >= 100
          ? "Ready"
          : "Not ready yet";

  // Each milestone borrows the color of the category that unlocked it.
  const readinessColor =
    totalProgress.percent >= 150
      ? CATEGORY_STYLE["Supplemental Goals"].iconText
      : totalProgress.percent >= 125
        ? CATEGORY_STYLE["Bonus"].iconText
        : totalProgress.percent >= 100
          ? CATEGORY_STYLE["Mandatory Part"].iconText
          : "text-text-secondary";

  return (
    <div className="w-full space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-text-secondary">
          Track your own defense checklist so you know exactly what to review
          before the correction.
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm font-medium">
          <HiOutlineShieldCheck className={`h-5 w-5 ${readinessColor}`} />
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
            <span className="font-bold text-brand-500">
              {totalProgress.currentValue}
            </span>
            <span className="text-text-secondary">
              {" "}
              / {totalProgress.completeAt} —{" "}
            </span>
            <span className="font-bold text-brand-500">
              {totalProgress.percent}%
            </span>
          </span>
        </div>
        <div
          className="h-2 w-full rounded-full bg-surface-overlay"
          role="progressbar"
          aria-valuenow={totalProgress.percent}
          aria-valuemin={0}
          aria-valuemax={150}
          aria-labelledby="overall-progress-heading"
        >
          <div
            className="h-2 rounded-full bg-brand-500"
            style={{
              width: `${Math.min((totalProgress.percent / 150) * 100, 100)}%`,
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
          <span>{totalProgress.percent}%</span>
          <span>Defense day</span>
        </div>
      </section>
      <div className="space-y-4">
        {accordionItemData.map((item, i) => {
          const style = CATEGORY_STYLE[item.title];
          const categoryPercent = categoryPercents[i];
          const isCategoryComplete = categoryPercent >= 100;
          const isCategoryFull =
            item.contents.length >= EVALUATION_CHECKLIST_MAX_ITEMS_PER_CATEGORY;

          function addChecklistItem() {
            if (item.contents.length >= EVALUATION_CHECKLIST_MAX_ITEMS_PER_CATEGORY)
              return;
            const input = document.getElementById(
              `textinput-${i}`
            ) as HTMLInputElement;
            if (
              input.value.trim().length > 0 &&
              input.value.length <= EVALUATION_CHECKLIST_ITEM_MAX_LENGTH
            )
              createItem({
                label: input.value,
                order: item.contents.length,
                section: sectionByIndex[i],
              });
            input.value = "";
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
                          <style.icon className={`h-5 w-5 ${style.iconText}`} />
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
                        <div className="h-1.5 w-24 rounded-full bg-surface-overlay">
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
                    {item.contents.map((c, j) => {
                      function commitLabel(newValue: string) {
                        if (newValue.trim().length && newValue !== c.label) {
                          updateItem(c.id, { label: newValue });
                        }
                        setEditingId(null);
                      }

                      return (
                        <div
                          key={j}
                          className="group flex items-center gap-2.5 rounded-md py-2 pr-2 pl-4 text-text-secondary hover:border hover:border-surface-border"
                        >
                          {/* checked:bg-current uses this text color as the
                          checkmark fill. */}
                          <Checkbox
                            className={style.checkedColor}
                            checked={c.isChecked}
                            onChange={() =>
                              updateItem(c.id, { isChecked: !c.isChecked })
                            }
                          />

                          {/* This edits the text:
                            - cancel on ESCAPE
                            - commit new text on ENTER or click out of the box                    */}
                          {editingId === c.id ? (
                            <TextInput
                              maxLength={EVALUATION_CHECKLIST_ITEM_MAX_LENGTH}
                              className="w-full px-2 text-sm"
                              defaultValue={c.label}
                              autoFocus
                              onBlur={(e) => {
                                if (
                                  e.currentTarget.value.length <=
                                  EVALUATION_CHECKLIST_ITEM_MAX_LENGTH
                                )
                                  commitLabel(e.currentTarget.value);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (
                                    e.currentTarget.value.length <=
                                    EVALUATION_CHECKLIST_ITEM_MAX_LENGTH
                                  )
                                    commitLabel(e.currentTarget.value);
                                }
                                if (e.key === "Escape") {
                                  setEditingId(null);
                                }
                              }}
                            />
                          ) : (
                            <p
                              className="w-full px-2 text-sm"
                              onDoubleClick={() => setEditingId(c.id)}
                            >
                              {c.label}
                            </p>
                          )}

                          <button
                            type="button"
                            className="opacity-0 transition-opacity group-hover:opacity-50"
                            aria-label="delete a project requirement"
                            onClick={() => deleteItem(c.id)}
                          >
                            <RiDeleteBackFill className="h-5 w-5" />
                          </button>
                        </div>
                      );
                    })}
                    <div className="mt-5 flex items-center gap-3">
                      <TextInput
                        className="flex-1"
                        id={`textinput-${i}`}
                        type="text"
                        placeholder={
                          isCategoryFull
                            ? `Limit of ${EVALUATION_CHECKLIST_MAX_ITEMS_PER_CATEGORY} items reached`
                            : "Add a defense checkpoint..."
                        }
                        required
                        disabled={isCategoryFull}
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
                        disabled={isCategoryFull}
                        onClick={() => {
                          addChecklistItem();
                        }}
                      >
                        <HiPlus className="mr-1 h-4 w-4" />
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
            <FaRegStar className="mt-0.5 h-4 w-4 shrink-0 text-status-review" />
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
