// Contact page (/contact). Mandatory for 42 subject.
import { createFileRoute } from "@tanstack/react-router";

import { useState, type FormEvent } from "react";
import { Button, Label, TextInput, Textarea } from "flowbite-react";

export const Route = createFileRoute("/_public/contact")({
  component: ContactPage,
});

const CONTACT_EMAIL = "[your contact email]";

type TeamMember = {
  name: string;
  role: string;
  email: string;
};

// Fill in your teammates here — one entry per person.
const team: TeamMember[] = [
  {
    name: "[Member name]",
    role: "[role / 42 login]",
    email: "[login]@student.42.fr",
  },
  {
    name: "[Member name]",
    role: "[role / 42 login]",
    email: "[login]@student.42.fr",
  },
  {
    name: "[Member name]",
    role: "[role / 42 login]",
    email: "[login]@student.42.fr",
  },
];

export function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`Contact from ${name || "a visitor"}`);
    const body = encodeURIComponent(`${message}\n\nFrom: ${name} <${email}>`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <main className="bg-surface-base min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-12 text-text-secondary">
        <h1 className="text-3xl font-bold text-text-primary">Contact</h1>
        <p className="mt-2 leading-relaxed">
          Have a question about the workspace, found a bug, or want to share
          feedback? Reach out to the team using the form below or the details
          provided.
        </p>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-text-primary">The team</h2>
          <p className="leading-relaxed">
            You can also reach out to any team member directly:
          </p>

          <ul className="grid gap-3 sm:grid-cols-2">
            {team.map((member, i) => (
              <li
                key={i}
                className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
              >
                <p className="font-medium text-text-primary">{member.name}</p>
                <p className="text-sm">{member.role}</p>
                <a
                  href={`mailto:${member.email}`}
                  className="mt-1 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {member.email}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">
            Send a message
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="mb-1 block text-text-secondary">
                Your name
              </Label>
              <TextInput
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="email" className="mb-1 block text-text-secondary">
                Your email
              </Label>
              <TextInput
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <Label
                htmlFor="message"
                className="mb-1 block text-text-secondary"
              >
                Message
              </Label>
              <Textarea
                id="message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            <Button type="submit">Send message</Button>
          </form>
        </section>
      </div>
    </main>
  );
}
