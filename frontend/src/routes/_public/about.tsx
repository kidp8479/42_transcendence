// About page (/about). Mandatory for 42 subject.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/about")({
  component: AboutPage,
});

type Block = string | { list: string[] };
type Section = { heading: string; blocks: Block[] };

const sections: Section[] = [
  {
    heading: "What is Transcendence Project?",
    blocks: [
      `Transcendence Project is a collaborative workspace built by and for 42 students. It brings project planning, task tracking, and teamwork together in one simple web application, so student teams can organize their school projects from the first read of the subject to the final defense.`,
      `It is a non-commercial project developed for educational purposes as part of the 42 curriculum.`,
    ],
  },
  {
    heading: "Why we built it",
    blocks: [
      `Students at 42 work in groups all the time, yet there is no shared space designed for the way the school actually works. Professional organization tools exist, but they are often complex, heavy, and built for companies rather than students. Transcendence Project aims to be the simple alternative: a workspace that makes it easy for classmates to plan, share, and move forward together.`,
    ],
  },
  {
    heading: "What you can do",
    blocks: [
      {
        list: [
          `Sign in with your 42 or Google account in a single click.`,
          `Add friends and build a team for each project.`,
          `Create a workspace per project and invite your teammates to it.`,
          `Organize your work with dashboards, Kanban boards, task lists, and a shared calendar.`,
          `Track progress, priorities, deadlines, and team workload at a glance.`,
          `Prepare your defense with dedicated evaluation checklists.`,
          `Receive real-time notifications when your teammates make changes.`,
        ],
      },
    ],
  },
  {
    heading: "Built at 42",
    blocks: [
      `This project was created by students of 42, a peer-to-peer coding school. It is a full-stack, single-page web application that combines real-time collaboration, live notifications, and secure user accounts, and it is built to support many users working together at the same time.`,
    ],
  },
];

export function AboutPage() {
  return (
    <main className="bg-surface-base min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-12 text-text-secondary">
        <h1 className="text-3xl font-bold text-text-primary">About</h1>

        {sections.map((section, i) => (
          <section key={i} className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold text-text-primary">
              {section.heading}
            </h2>
            {section.blocks.map((block, j) =>
              typeof block === "string" ? (
                <p key={j} className="leading-relaxed">
                  {block}
                </p>
              ) : (
                <ul key={j} className="list-disc space-y-1 pl-6">
                  {block.list.map((item, k) => (
                    <li key={k}>{item}</li>
                  ))}
                </ul>
              )
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
