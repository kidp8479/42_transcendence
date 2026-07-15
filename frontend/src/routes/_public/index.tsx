/**
 * Root route ("/").
 * This file must remain named `index.tsx` so the file-based router
 * can resolve the application's entry point.
 * Renders the LandingPage component.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Carousel } from "flowbite-react";
import { useModal } from "../../hooks/useModal";

// TO DISCUSS: if we want logged-in users to skip the landing page and go straight to /dashboard,
// add a beforeLoad here that checks localStorage for a token and throws redirect({ to: '/dashboard' }).
export const Route = createFileRoute("/_public/")({
  component: LandingPage,
});

// TEMP placeholder screenshots - replace with final production content later - use frontend/public/images to place your images
const CAROUSEL_SLIDES = [
  {
    image: "/images/landing-carousel-1.png",
    alt: "Projects list showing multiple projects with their team members",
    tag: "Teamwork",
    title: "Solo or with a team",
    text: "Working alone? Track your own progress from the first read of the subject to the final defense. Working with others? Create a team, invite your teammates, and split the work together. Same tool, either way.",
  },
  {
    image: "/images/landing-carousel-2.png",
    alt: "Project summary page with tabs for Discovery, Kanban, List, Calendar, and Evaluation Checklist",
    tag: "Workflow",
    title: "Everything you need, in one place",
    text: "Start with the discovery page to lay out your project before touching any code. Split the work into a Kanban board, switch to task lists when you need a different view, check the calendar to see deadlines and everyone's availability, and track your own defense checklist when it's time to prepare.",
  },
  {
    image: "/images/landing-carousel-3.png",
    alt: "Dashboard overview showing active projects, tickets, and team velocity",
    tag: "Growth",
    title: "A tool worth learning on",
    text: "We picked the best parts of the project management tools out there and built something simple enough for 42. Not sure this kind of tool is for you? This is a low-pressure way to find out. Already sold on it? It's real practice organizing a team and your own work, the same skills you'll need once you're doing this for a job.",
  },
];

function LandingPage() {
  const { openAuthModal } = useModal();

  return (
    <>
      <section className="flex flex-col items-center justify-center bg-surface-base px-4 py-16 text-text-primary sm:py-20 lg:py-28">
        <span className="font-mono text-xs uppercase tracking-widest text-brand-500">
          Built for 42 students
        </span>
        <h1 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          42 Project Planner
        </h1>
        <p className="mt-4 max-w-xl text-center text-lg text-text-primary">
          A workspace built by{" "}
          <span className="font-semibold text-brand-500">42 students</span>, for
          the way we actually get projects done,{" "}
          <span className="font-semibold text-brand-500">
            solo or with a team
          </span>
          .
        </p>
        <p className="mt-6 max-w-3xl text-center text-text-secondary">
          Starting a project is hard enough already. Throw in team coordination,
          deadlines, and tools built for companies instead of students, and it
          gets messy fast. Most of us don't even bother: we don't know what's
          out there, the market options feel like overkill for what we actually
          need, or we're just lazy about it (no judgment, we've been there). But
          organizing your work is{" "}
          <span className="font-semibold text-brand-500">a real skill</span>,
          one you'll need for real once you're on a dev team. So we built our
          own, simple, and{" "}
          <span className="font-semibold text-brand-500">
            made for the way 42 actually works
          </span>
          .
        </p>
      </section>

      <h2 className="text-center font-mono text-xs uppercase tracking-widest text-brand-500">
        A look inside
      </h2>

      {/* Fixed height (not h-full) - Flowbite's internal Carousel wrapper has no
          height of its own, so a percentage height here would never resolve.
          Values are arbitrary (not h-104/h-112 - not part of Tailwind's default
          scale and this repo has no custom spacing theme) and sized to fit the
          tallest slide's content at each breakpoint without being clipped by
          overflow-hidden. */}
      <section
        aria-label="Product tour"
        className="mx-auto mt-3 h-[31rem] max-w-5xl overflow-hidden rounded-2xl border border-brand-500 shadow-lg sm:h-96 md:h-[26rem] lg:h-[28rem]"
      >
        <Carousel
          slideInterval={6000}
          theme={{
            item: {
              base: "relative",
            },
          }}
        >
          {CAROUSEL_SLIDES.map((slide) => (
            <div
              key={slide.image}
              className="flex h-[31rem] flex-col items-center bg-surface-raised sm:h-96 md:h-[26rem] md:flex-row lg:h-[28rem]"
            >
              <img
                src={slide.image}
                alt={slide.alt}
                className="h-40 w-full object-cover object-top md:h-full md:w-1/2"
              />
              <div className="w-full px-8 py-6 md:w-1/2 md:px-16">
                <span className="font-mono text-xs uppercase tracking-widest text-brand-500">
                  {slide.tag}
                </span>
                <h3 className="mt-1 text-2xl font-bold text-text-primary md:text-3xl">
                  {slide.title}
                </h3>
                <p className="mt-4 text-text-secondary">{slide.text}</p>
              </div>
            </div>
          ))}
        </Carousel>
      </section>

      <p className="px-4 py-16 text-center text-text-secondary sm:py-20 lg:py-28">
        Ready to jump in?{" "}
        <a
          href="#create-account"
          onClick={(event) => {
            event.preventDefault();
            openAuthModal("signup");
          }}
          className="font-semibold text-brand-500 hover:text-brand-600 hover:underline"
        >
          Create an account
        </a>{" "}
        or{" "}
        <a
          href="#log-in"
          onClick={(event) => {
            event.preventDefault();
            openAuthModal("signin");
          }}
          className="font-semibold text-brand-500 hover:text-brand-600 hover:underline"
        >
          log in
        </a>
        .
      </p>
    </>
  );
}
