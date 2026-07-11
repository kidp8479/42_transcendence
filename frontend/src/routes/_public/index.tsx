/**
 * Root route ("/").
 * This file must remain named `index.tsx` so the file-based router
 * can resolve the application's entry point.
 * Renders the LandingPage component.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Carousel } from "flowbite-react";

// TO DISCUSS: if we want logged-in users to skip the landing page and go straight to /dashboard,
// add a beforeLoad here that checks localStorage for a token and throws redirect({ to: '/dashboard' }).
export const Route = createFileRoute("/_public/")({
  component: LandingPage,
});

// TEMP placeholder screenshots and copy - replace with final production content later
const CAROUSEL_SLIDES = [
  {
    image: "/images/landing-carousel-1.png",
    alt: "Projects list showing multiple projects with their team members",
    title: "Solo or with a team",
    text: "Working alone? Track your own progress from the first read of the subject to the final defense. Working with others? Create a team, invite your teammates, and split the work together. Same tool, either way.",
  },
  {
    image: "/images/landing-carousel-2.png",
    alt: "Project summary page with tabs for Discovery, Kanban, List, Calendar, and Evaluation Checklist",
    title: "Everything you need, in one place",
    text: "Start with the discovery page to lay out your project before touching any code. Split the work into a Kanban board, switch to task lists when you need a different view, and check the calendar to see deadlines and everyone's availability.",
  },
  {
    image: "/images/landing-carousel-3.png",
    alt: "Evaluation checklist with defense-readiness items to check off",
    title: "Your own defense checklist",
    text: "Build your own checklist of what you need before defense, check things off at your own pace, and decide for yourself when you're ready. It's your list, not a grade sheet we hand you.",
  },
];

function LandingPage() {
  return (
    <>
      <div className="flex flex-col items-center justify-center bg-surface-base px-4 py-16 text-text-primary sm:py-20 lg:py-28">
        <h1 className="text-center text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          42 Project Planner
        </h1>
        <p className="mt-4 max-w-xl text-center text-text-secondary">
          A workspace built by 42 students, for the way we actually get projects
          done, solo or with a team.
        </p>
        <p className="mt-6 max-w-2xl text-center text-text-secondary">
          Starting a project is hard enough already. Throw in team coordination,
          deadlines, and tools built for companies instead of students, and it
          gets messy fast. Most of us don't even bother: we don't know what's
          out there, the market options feel like overkill for what we actually
          need, or we're just lazy about it. But organizing your work is a real
          skill, one you'll need for real once you're on a dev team. So we built
          our own, simple, and made for the way 42 actually works.
        </p>
      </div>

      {/* Fixed height (not h-full) - Flowbite's internal Carousel wrapper has no
          height of its own, so a percentage height here would never resolve. */}
      <div className="mx-auto h-80 max-w-5xl overflow-hidden rounded-2xl sm:h-96 xl:h-112">
        <Carousel
          theme={{
            item: {
              base: "relative",
            },
          }}
        >
          {CAROUSEL_SLIDES.map((slide) => (
            <div
              key={slide.image}
              className="flex h-80 flex-col items-center bg-surface-raised sm:h-96 md:flex-row xl:h-112"
            >
              <img
                src={slide.image}
                alt={slide.alt}
                className="h-40 w-full object-cover object-top md:h-full md:w-1/2"
              />
              <div className="w-full px-8 py-6 md:w-1/2 md:px-16">
                <h3 className="text-2xl font-bold text-text-primary md:text-3xl">
                  {slide.title}
                </h3>
                <p className="mt-4 text-text-secondary">{slide.text}</p>
              </div>
            </div>
          ))}
        </Carousel>
      </div>
    </>
  );
}
