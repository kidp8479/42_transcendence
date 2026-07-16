// Shared layout for the static legal/info pages (About, Privacy, Terms).
// Renders a title followed by a list of sections, each made of paragraphs
// and/or bullet lists.
export type Block = string | { list: string[] };
export type Section = { heading: string; blocks: Block[] };

type LegalPageLayoutProps = {
  title: string;
  subtitle?: string;
  sections: Section[];
};

export function LegalPageLayout({
  title,
  subtitle,
  sections,
}: LegalPageLayoutProps) {
  return (
    <article className="bg-surface-base">
      <div className="mx-auto max-w-3xl px-4 py-12 text-text-secondary">
        <h1 className="text-3xl font-bold text-text-primary">{title}</h1>
        {subtitle && <p className="mt-2 text-sm">{subtitle}</p>}

        {sections.map((section) => (
          <section key={section.heading} className="mt-8 space-y-3">
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
    </article>
  );
}
