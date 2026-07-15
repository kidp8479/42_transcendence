// Contact page (/contact). Mandatory for 42 subject.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/contact")({
  component: ContactPage,
});

type TeamMember = {
  name: string;
  email: string;
};

// Fill in your teammates here — one entry per person.
const team: TeamMember[] = [
  { name: "Carlos", email: "cade-jes@student.42.fr" },
  { name: "Andrei", email: "abelov@student.42.fr" },
  { name: "Pauline", email: "pafroidu@student.42.fr" },
  { name: "Christophe", email: "cgajean@student.42.fr" },
  { name: "Diana", email: "diade-so@student.42.fr" },
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

        <section className="mt-8 space-y-3 rounded-lg border border-brand-500">
          <h2 className="text-xl font-semibold text-text-primary pl-4 pt-4">
            The team
          </h2>
          <p className="pl-4 leading-relaxed">
            You can also reach out to any team member directly:
          </p>

          <ul className="grid sm:grid-cols-2">
            {team.map((member, i) => (
              <li key={i} className="p-4 pl-8">
                <p className="font-medium text-text-primary">{member.name}</p>
                <a
                  href={`mailto:${member.email}`}
                  className="mt-1 inline-block text-sm font-medium text-text-secondary hover:text-brand-700"
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
