import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectRow } from "../src/components/ProjectCard";
import type { Project } from "../src/types";

function p(over: Partial<Project>): Project {
  return {
    id: "x", path: "x", absPath: "/x", kind: "node", name: "x",
    description: null, descriptionAuto: null, language: "node",
    frameworks: [], tags: [], startCommand: null, startCommandDetected: null,
    port: null, portDetected: null, archived: false,
    children: [], parent: null,
    lastEditedByUser: null, gitBranch: null, lastModified: null,
    ...over,
  };
}

function withRouter(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ProjectRow", () => {
  it("renders the name and description", () => {
    const proj = p({ id: "photo", name: "photo", descriptionAuto: "Sample photo project." });
    render(withRouter(<ProjectRow project={proj} runState="idle" />));
    expect(screen.getByText("photo")).toBeInTheDocument();
    expect(screen.getByText("Sample photo project.")).toBeInTheDocument();
  });

  it("prefers user description over auto", () => {
    const proj = p({ id: "x", description: "user wrote this", descriptionAuto: "auto wrote that" });
    render(withRouter(<ProjectRow project={proj} runState="idle" />));
    expect(screen.getByText("user wrote this")).toBeInTheDocument();
    expect(screen.queryByText("auto wrote that")).not.toBeInTheDocument();
  });

  it("renders frameworks and tags", () => {
    const proj = p({ id: "x", frameworks: ["next", "react"], tags: ["活跃"] });
    render(withRouter(<ProjectRow project={proj} runState="idle" />));
    expect(screen.getByText("next")).toBeInTheDocument();
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("#活跃")).toBeInTheDocument();
  });

  it("uses dim style for archived projects", () => {
    const proj = p({ id: "x", archived: true });
    const { container } = render(withRouter(<ProjectRow project={proj} runState="idle" />));
    expect(container.firstChild).toHaveClass("is-archived");
  });

  it("shows conflict flag when conflictPeerIds given", () => {
    const proj = p({ id: "a", portDetected: 3000 });
    render(
      withRouter(
        <ProjectRow
          project={proj}
          runState="idle"
          conflictPeerIds={["b", "c"]}
        />,
      ),
    );
    // ⚠ ×3 = self + 2 peers
    expect(screen.getByText(/⚠ ×3/)).toBeInTheDocument();
  });

  it("renders the children pill when childCount > 0", () => {
    const parent = p({ id: "p", name: "p" });
    render(withRouter(<ProjectRow project={parent} runState="idle" childCount={3} />));
    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("does NOT render children inline (children only on parent's detail page)", () => {
    const parent = p({ id: "p", name: "parent" });
    render(withRouter(<ProjectRow project={parent} runState="idle" childCount={1} />));
    expect(screen.queryByText("child-name")).not.toBeInTheDocument();
  });

  it("renders the run-state label", () => {
    const proj = p({ id: "x" });
    render(withRouter(<ProjectRow project={proj} runState="running-external" />));
    expect(screen.getByText("EXTERNAL")).toBeInTheDocument();
  });
});
