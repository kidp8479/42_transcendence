// Style guide page - accessible at /dont-panic during development.
// Consult this before building any screen. Shows the color palette,
// components, and conventions the whole team should follow. Can be changed anytime if styling decisions are made.
import { createFileRoute } from "@tanstack/react-router";
import { Badge, Button, Card, TextInput, ToggleSwitch } from "flowbite-react";

export const Route = createFileRoute("/_public/dont-panic")({
  component: StyleGuidePage,
});

const PALETTE_COLORS = [
  { bg: "bg-brand-500", label: "bg-brand-500", note: "primary action" },
  { bg: "bg-brand-600", label: "bg-brand-600", note: "hover state" },
  {
    bg: "bg-surface-base",
    label: "bg-surface-base",
    note: "page background",
    border: true,
  },
  {
    bg: "bg-surface-raised",
    label: "bg-surface-raised",
    note: "cards",
    border: true,
  },
  {
    bg: "bg-surface-overlay",
    label: "bg-surface-overlay",
    note: "modals",
    border: true,
  },
  {
    bg: "bg-surface-border",
    label: "bg-surface-border",
    note: "borders, dividers",
    border: true,
  },
  { bg: "bg-red-700", label: "bg-red-700", note: "danger / error" },
  { bg: "bg-yellow-400", label: "bg-yellow-400", note: "warning" },
];

const TEXT_STYLES = [
  {
    color: "text-text-primary",
    label: "text-text-primary",
    note: "headings, key info",
  },
  {
    color: "text-text-secondary",
    label: "text-text-secondary",
    note: "body text",
  },
  {
    color: "text-text-muted",
    label: "text-text-muted",
    note: "hints, timestamps",
  },
];

function StyleGuidePage() {
  return (
    <div className="min-h-screen bg-surface-base text-text-primary p-10 space-y-14">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-2xl font-mono font-bold text-brand-500">
          TASK RABBIT - Style Guide
        </h1>
        <div className="border-l-2 border-brand-500 pl-4 max-w-2xl space-y-2">
          <p className="text-text-secondary text-sm">
            This is not a final design decision. It's a temporary starting point
            so the team can build together with visual consistency from day one
            - same components, same color names, same conventions. The palette
            and style can be updated at any time by the team.
          </p>
          <p className="text-text-muted text-xs">
            To change the color palette globally, just edit the{" "}
            <span className="font-mono text-text-secondary">@theme</span> block
            in{" "}
            <span className="font-mono text-text-secondary">
              frontend/src/index.css
            </span>{" "}
            - every screen updates automatically.
          </p>
          <p className="text-text-muted text-xs">
            Once the app is built, this page can be replaced by an easter egg
            triggered by clicking the logo when already on the landing page. One
            idea: a picture of Moulinette (the cat of 42 Paris to give Andrei
            some context :D), judging people hard because they're snooping
            around on our website.
          </p>
          <p className="text-text-muted text-xs">
            Don't take this page source code as an exemple, I have no idea (yet)
            what I'm doing react wise.
          </p>
        </div>
      </div>

      {/* How to use */}
      <section className="space-y-4 max-w-2xl">
        <h2 className="text-xs font-mono uppercase tracking-widest text-text-muted">
          How to use this page
        </h2>
        <div className="border border-surface-border p-5 space-y-3 text-sm text-text-secondary">
          <p>
            Before writing any HTML or CSS for a new page, come here first. This
            page shows example components and color names the whole team can use
            to develop with the same base. Sticking to these keeps the app
            consistent without coordinating every detail. When we want to change
            the style, we do it in index.css.
          </p>
          <p className="font-mono text-text-muted text-xs border-t border-surface-border pt-3">
            Step 1 - Need a button, input, card, modal?
            <br />
            <span className="text-text-secondary">
              - Use a Flowbite component (see below). Don't write a raw
              &lt;button&gt; or &lt;input&gt; tag.
            </span>
          </p>
          <p className="font-mono text-text-muted text-xs">
            Step 2 - Need a color?
            <br />
            <span className="text-text-secondary">
              - Use the names from the Palette section below (ex: bg-brand-500,
              text-text-secondary). Never hardcode a hex value like #22c55e
              directly in a className. Look for the names to use in index.css.
            </span>
          </p>
          <p className="font-mono text-text-muted text-xs">
            Step 3 - Need layout or spacing?
            <br />
            <span className="text-text-secondary">
              - Use Tailwind utility classes: flex, gap-4, p-6, grid, etc. No
              custom CSS files.
            </span>
          </p>
          <p className="font-mono text-text-muted text-xs">
            Step 4 - Need something that doesn't exist here?
            <br />
            <span className="text-text-secondary">
              - Check flowbite-react.com/docs/getting-started/introduction
              first. If it's not there either, build it and add it to this page
              if you can so everyone can reuse it.
            </span>
          </p>
        </div>
      </section>

      {/* Palette */}
      <section className="space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-widest text-text-muted">
          Palette
        </h2>
        <p className="text-text-muted text-xs">
          These are the custom color names declared in the{" "}
          <span className="font-mono text-text-secondary">@theme</span> block in{" "}
          <span className="font-mono text-text-secondary">
            frontend/src/index.css
          </span>
          .
        </p>
        <p className="text-text-muted text-xs border-l-2 border-surface-border pl-4 max-w-2xl">
          These names aren't classes on their own - they're the{" "}
          <span className="font-mono text-text-secondary">*</span> in a Tailwind
          utility, so you always attach them to what property you want colored:{" "}
          <span className="font-mono text-text-secondary">bg-surface-base</span>{" "}
          for a background,{" "}
          <span className="font-mono text-text-secondary">text-brand-500</span>{" "}
          for text color,{" "}
          <span className="font-mono text-text-secondary">
            border-surface-border
          </span>{" "}
          for a border. Writing just{" "}
          <span className="font-mono text-text-secondary">
            className="surface-base"
          </span>{" "}
          does nothing - Tailwind won't generate a class for a color name with
          no prefix telling it what to color.
        </p>
        <div className="flex flex-wrap gap-6">
          {PALETTE_COLORS.map(({ bg, label, note, border }) => (
            <div key={label} className="flex flex-col gap-1">
              <div
                className={`w-14 h-14 ${bg} ${border ? "border border-surface-border" : ""}`}
              />
              <span className="text-text-primary text-xs font-mono">
                {label}
              </span>
              <span className="text-text-muted text-xs">{note}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-6 pt-2">
          {TEXT_STYLES.map(({ color, label, note }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className={`text-lg font-mono ${color}`}>Aa</span>
              <span className="text-text-muted text-xs font-mono">{label}</span>
              <span className="text-text-muted text-xs">{note}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Components note */}
      <section className="max-w-2xl">
        <p className="text-text-muted text-xs border-l-2 border-surface-border pl-4">
          The components below are taken from the Flowbite React docs as usage
          examples. They are not a hard rule - feel free to use different props,
          sizes, or variants depending on what you're building. The goal is just
          to show how to import and use them.
        </p>
      </section>

      {/* Buttons */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-text-muted">
          Buttons
        </h2>
        <p className="text-text-muted text-xs">
          Import:{" "}
          <span className="font-mono text-text-secondary">
            {"import { Button } from 'flowbite-react'"}
          </span>
        </p>
        <p className="text-text-muted text-xs border-l-2 border-surface-border pl-4 max-w-2xl">
          Heads up:{" "}
          <span className="font-mono text-text-secondary">color="green"</span>{" "}
          below is Flowbite's own built-in green (Tailwind's{" "}
          <span className="font-mono text-text-secondary">green-700</span>), not
          our <span className="font-mono text-text-secondary">brand-*</span>{" "}
          tokens from{" "}
          <span className="font-mono text-text-secondary">index.css</span>. They
          match today because our{" "}
          <span className="font-mono text-text-secondary">brand-*</span> scale
          was deliberately picked to line up with Tailwind's green, but it's
          still not a real link - if the palette in{" "}
          <span className="font-mono text-text-secondary">index.css</span>{" "}
          changes, this button won't follow. That's the difference between our
          own elements (a{" "}
          <span className="font-mono text-text-secondary">
            {'<div className="bg-brand-500">'}
          </span>{" "}
          always follows the theme automatically) and Flowbite components (their{" "}
          <span className="font-mono text-text-secondary">color</span> prop uses
          a fixed internal palette that has to be explicitly wired up to our
          theme - not done yet, we'll do it if/ when we need to change the
          visual style and want Flowbite components to follow along).
        </p>
        <div className="flex flex-wrap gap-3">
          <Button color="green">Primary</Button>
          <Button color="dark">Secondary</Button>
          <Button color="red">Danger</Button>
          <Button outline color="green">
            Outline
          </Button>
          <Button disabled color="green">
            Disabled
          </Button>
        </div>
        <p className="text-text-muted text-xs font-mono">
          {'<Button color="green">Primary</Button>'}
          <br />
          {'<Button color="dark">Secondary</Button>'}
          <br />
          {'<Button color="red">Danger</Button>'}
        </p>
      </section>

      {/* Badges */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-text-muted">
          Badges - task status
        </h2>
        <p className="text-text-muted text-xs">
          Import:{" "}
          <span className="font-mono text-text-secondary">
            {"import { Badge } from 'flowbite-react'"}
          </span>
        </p>
        <div className="flex flex-wrap gap-3">
          <Badge color="green">Done</Badge>
          <Badge color="yellow">In progress</Badge>
          <Badge color="red">Blocked</Badge>
          <Badge color="gray">Backlog</Badge>
          <Badge color="blue">Review</Badge>
        </div>
      </section>

      {/* Inputs */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-text-muted">
          Inputs
        </h2>
        <p className="text-text-muted text-xs">
          Import:{" "}
          <span className="font-mono text-text-secondary">
            {"import { TextInput } from 'flowbite-react'"}
          </span>
        </p>
        <div className="flex flex-col gap-3 max-w-sm">
          <TextInput placeholder="Search tasks..." />
          <TextInput placeholder="Project name" />
        </div>
      </section>

      {/* Toggle */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-text-muted">
          Toggle
        </h2>
        <p className="text-text-muted text-xs">
          Import:{" "}
          <span className="font-mono text-text-secondary">
            {"import { ToggleSwitch } from 'flowbite-react'"}
          </span>
        </p>
        <div className="flex gap-6">
          <ToggleSwitch
            label="Notifications"
            checked={true}
            onChange={() => {}}
          />
          <ToggleSwitch label="Dark mode" checked={false} onChange={() => {}} />
        </div>
      </section>

      {/* Cards */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-text-muted">
          Cards
        </h2>
        <p className="text-text-muted text-xs">
          Import:{" "}
          <span className="font-mono text-text-secondary">
            {"import { Card } from 'flowbite-react'"}
          </span>
        </p>
        <p className="text-text-muted text-xs">
          Always add{" "}
          <span className="font-mono text-text-secondary">
            className="bg-surface-raised border-surface-border"
          </span>{" "}
          to every Card - without it the background defaults to white.
        </p>
        <div className="flex flex-wrap gap-4">
          <Card className="max-w-sm bg-surface-raised border-surface-border">
            <div className="flex items-center justify-between">
              <h5 className="font-mono font-semibold text-text-primary">
                Fix auth middleware
              </h5>
              <Badge color="red">Blocked</Badge>
            </div>
            <p className="text-text-secondary text-sm">
              Session tokens not compliant with new security requirements.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-xs font-mono">TR-42</span>
              <Button size="xs" color="green">
                Open
              </Button>
            </div>
          </Card>
          <Card className="max-w-sm bg-surface-raised border-surface-border">
            <div className="flex items-center justify-between">
              <h5 className="font-mono font-semibold text-text-primary">
                Backend scaffold
              </h5>
              <Badge color="yellow">In progress</Badge>
            </div>
            <p className="text-text-secondary text-sm">
              NestJS modules, controllers, services and DTOs.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-xs font-mono">TR-34</span>
              <Button size="xs" outline color="green">
                Open
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* More components */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-text-muted">
          More components
        </h2>
        <p className="text-text-secondary text-sm">
          Flowbite has ready-made components for everything else you'll need:
          modals, dropdowns, notifications, tables, sidebars, date pickers, and
          more.
        </p>
        <p className="text-text-muted text-xs">
          Before building anything custom, check{" "}
          <span className="font-mono text-text-secondary">
            flowbite-react.com/docs/getting-started/introduction
          </span>{" "}
          - copy the import and drop it in.
        </p>
      </section>
    </div>
  );
}
