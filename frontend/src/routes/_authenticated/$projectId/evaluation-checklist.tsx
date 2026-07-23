import { createFileRoute, useLoaderData } from "@tanstack/react-router";
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
import { HiOutlineShieldCheck, HiOutlineGift, HiPlus } from "react-icons/hi";
import type { IconType } from "react-icons";
import { RiDeleteBackFill } from "react-icons/ri";
import { EvaluationChecklistSection, fetchEvaluationChecklistItems } from "@/lib/evaluationChecklist";

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

// Mock data

export interface AccordionItemData {
  title: string;
  contents: string[];
}


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
    description:
      "Supplemental goals are extras beyond the subject requirements. They won't affect your mandatory pass, but show evaluators you went the extra mile.",
  },
};

function EvaluationChecklistPage() {
  // Mock readiness numbers - will come from the same defense_readiness payload
  // as summary.tsx once the backend endpoint exists.
  const checkpointsTotal = 12;
  const checkpointsDone = 9;
  const percent = Math.round((checkpointsDone / checkpointsTotal) * 100);
  const isReady = percent === 100;

  // same file, no need "from"
  const checklistItems = Route.useLoaderData();

  let accordionItemData: AccordionItemData[] = [
    {
      title: "Mandatory Part",
      contents: [],
    },
    {
      title: "Bonus",
      contents: [],
    },
    {
      title: "Supplemental Goals",
      contents: [],
    },
  ];  

  for (const item of checklistItems) {
    item.section === "MANDATORY" ? accordionItemData[0].contents.push(item.label) :
      item.section === "BONUS" ? accordionItemData[1].contents.push(item.label) :
        accordionItemData[2].contents.push(item.label);
  }

  return (
    <div className="w-full space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-text-secondary">
          Track your own defense checklist so you know exactly what to review
          before the correction.
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm font-medium text-text-secondary">
          <HiOutlineShieldCheck
            className={`h-5 w-5 ${isReady ? "text-brand-500" : "text-status-review"}`}
          />
          {isReady ? "Ready" : "Not ready yet"}
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
            <span className="font-bold text-brand-500">{checkpointsDone}</span>
            <span className="text-text-secondary">
              {" "}
              / {checkpointsTotal} —{" "}
            </span>
            <span className="font-bold text-brand-500">{percent}%</span>
          </span>
        </div>
        <div
          className="h-2 w-full rounded-full bg-surface-overlay"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-labelledby="overall-progress-heading"
        >
          <div
            className="h-2 rounded-full bg-brand-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
          <span>{percent}%</span>
          <span>Defense day</span>
        </div>
      </section>

      <div className="space-y-4">
        {accordionItemData.map((item, i) => {
          const style = CATEGORY_STYLE[item.title];
          const total = item.contents.length;
          const done = 0;
          const categoryPercent =
            total === 0 ? 0 : Math.round((done / total) * 100);

          return (
            <ThemeProvider key={item.title} theme={customTheme}>
              <Accordion className="overflow-hidden rounded-lg border border-surface-border">
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
                            {done}/{total} completed
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
                    {item.contents.map((c, j) => (
                      <div
                        key={j}
                        className="group flex items-center gap-2.5 rounded-md py-2 pr-2 pl-4 text-text-secondary hover:border hover:border-surface-border"
                      >
                        {/* checked:bg-current uses this text color as the
                        checkmark fill. */}
                        <Checkbox className={style.checkedColor} />
                        <p className="w-full px-2 text-sm">{c}</p>
                        <button
                          type="button"
                          onClick={() => console.log("deleted")}
                          className="opacity-0 transition-opacity group-hover:opacity-50"
                          aria-label="delete a project requirement"
                        >
                          <RiDeleteBackFill className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                    <div className="mt-5 flex items-center gap-3">
                      <TextInput
                        className="flex-1"
                        id={`textinput-${i}`}
                        type="text"
                        placeholder="Add a defense checkpoint..."
                        required
                        // className only reaches TextInput's outer wrapper, not the
                        // <input> itself, so the per-category hover/focus border has
                        // to go through the theme prop (merged onto field.input.colors.gray).
                        theme={{
                          field: {
                            input: { colors: { gray: style.inputBorder } },
                          },
                        }}
                      />
                      <Button color="gray" className={style.addButtonHover}>
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
