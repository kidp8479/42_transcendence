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

// TEMP placeholder screenshots - replace with final production screenshots and texts later
const CAROUSEL_SLIDES = [
  {
    image: "/images/landing-carousel-1.png",
    alt: "Task Rabbit kanban board",
    title: "Visualize your project like never before",
    text: "Drag-and-drop tasks across customizable columns. Assign teammates, set deadlines, and track progress - all in one view.",
  },
  {
    image: "/images/landing-carousel-2.png",
    alt: "List of features documentation",
    title: "Every feature planned in detail",
    text: "From foundation to global layout, each feature has its own implementation page - what to build, how to build it, and how to know when it's done.",
  },
  {
    image: "/images/landing-carousel-3.png",
    alt: "Filesystem structure documentation",
    title: "Built for 42 project sprints",
    text: "Fast, focused, and designed around the way we actually work on Transcendence.",
  },
];

function LandingPage() {
  return (
    <>
      <div className="flex flex-col items-center justify-center bg-surface-base py-32 text-text-primary">
        <h1 className="text-4xl font-bold tracking-tight">
          42 Project Planner
        </h1>
        <p className="mt-4 text-text-secondary">Tailwind is working.</p>
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
