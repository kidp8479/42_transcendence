// Contact page (/contact). Mandatory for 42 subject.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/contact")({
  component: ContactPage,
});

type TeamMember = {
  name: string;
  role: string;
  email: string;
};

// Fill in your teammates here — one entry per person.
const team: TeamMember[] = [
  {
    name: "Carlos",
    role: "[role / 42 login]",
    email: "cade-jes@student.42.fr",
  },
  { name: "Andrei", role: "[role / 42 login]", email: "abelov@student.42.fr" },
  {
    name: "Pauline",
    role: "[role / 42 login]",
    email: "pafroidu@student.42.fr",
  },
  {
    name: "Christophe",
    role: "[role / 42 login]",
    email: "cgajean@student.42.fr",
  },
  { name: "Diana", role: "[role / 42 login]", email: "diade-so@student.42.fr" },
];

export function ContactPage() {
  return (
    <div className="bg-surface-base min-h-screen">
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
              <li key={i} className="rounded-lg border border-gray-200 p-4">
                <p className="font-medium text-text-primary">{member.name}</p>
                <p className="text-sm">{member.role}</p>
                <a
                  href={`mailto:${member.email}`}
                  className="mt-1 inline-block text-sm font-medium text-blue-600 hover:underline"
                >
                  {member.email}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
