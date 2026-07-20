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
import { DefenseReadiness } from "@/components/summary/DefenseReadiness";
import { GrValidate } from "react-icons/gr";

export const Route = createFileRoute(
  "/_authenticated/$projectId/evaluation-checklist"
)({
  component: EvaluationChecklistPage,
});

const customTheme = createTheme({
  accordion: {
    root: {
      base: "divide-y border-surface-border border-surface-border dark:border-surface-border dark:border-surface-border",
    },
    content: {
      base: "py-5 px-5 bg-surface-raised dark:bg-surface-raised",
    },
    title: {
      base: "bg-surface-raised hover:bg-blue-100 dark:bg-surface-raised",
    },
  },
});

// Mock data

export interface AccordionItemData {
  title: string;
  contents: string[];
}

const mockData: AccordionItemData[] = [
  { title: "Defense Checklist", contents: ["OAuth 42 login works end-to-end", "Real-time Pong game runs without crash", "Player matchmaking connects two users", "User profile & stats plage render correctly", "Docker compose starts all services cleanly", "No forbidden functions / librairies used", "Norm compliance checked (norminette passes)", "All required bonus features toggled off for mandatory pass"] },
  { title: "Supplemental Goals", contents: ["Tournament mode with bracket", "Game customization options (speed, paddles)", "Live chat between players"] },
];

function EvaluationChecklistPage() {
  return (
    <div className="w-full space-y-8 font-mono">
      <section className="flex justify-between">
        <p className="text-text-muted">
          Track your own defense checklist so you know exactly what to review
          before the correction.
        </p>
        <div className="flex flex-col items-center border border-surface-border rounded-2xl p-3 border-">
          <GrValidate className="w-6 h-6" />
          <p>Not ready yet</p>
        </div>
      </section>
      <DefenseReadiness />
      {mockData.map((item, i) => (
        <ThemeProvider theme={customTheme}>
          <Accordion key={i}>
            <AccordionPanel>
              <AccordionTitle>
                <div className="flex gap-2 items-center">
                  <FaRegStar className="w-4.5 h-4.5"/>
                  {item.title}
                </div>
              </AccordionTitle>
              <AccordionContent>
                {item.contents.map((c, j) => (
                  <div
                    key={j}
                    className="flex mb-6 text-text-secondary dark:text-text-secondary items-center"
                  >
                    <Checkbox />
                    <p className="px-2.5">{c}</p>
                  </div>
                ))}
                <div className="flex gap-2">
                  <TextInput
                    className="flex-1"
                    id={`textinput-${i}`}
                    type="text"
                    placeholder="Add a defense checkpoint..."
                    required
                  />
                  <Button>Add</Button>
                </div>
              </AccordionContent>
            </AccordionPanel>
          </Accordion>
        </ThemeProvider>
      ))}
    </div>
  );
}
