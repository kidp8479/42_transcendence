//index.tsx this is where the landing page will live !

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute('/_public/')({
	component: LandingPage,
});

function LandingPage() {
	return (
		<div className="p-2">
          <h3>Welcome Home!</h3>
		</div>
	);
}
