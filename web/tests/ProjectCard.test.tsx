import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProjectCard } from "../src/components/ProjectCard";
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
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe("ProjectCard", () => {
  it("renders the name and description", () => {
    const proj = p({ id: "photo", name: "photo", descriptionAuto: "Sample photo project." });
    render(withRouter(<ProjectCard project={proj} />));
    expect(screen.getByText("photo")).toBeInTheDocument();
    expect(screen.getByText("Sample photo project.")).toBeInTheDocument();
  });

  it("prefers user description over auto", () => {
    const proj = p({ id: "x", description: "user wrote this", descriptionAuto: "auto wrote that" });
    render(withRouter(<ProjectCard project={proj} />));
    expect(screen.getByText("user wrote this")).toBeInTheDocument();
    expect(screen.queryByText("auto wrote that")).not.toBeInTheDocument();
  });

  it("renders frameworks and tags", () => {
    const proj = p({ id: "x", frameworks: ["next", "react"], tags: ["活跃"] });
    render(withRouter(<ProjectCard project={proj} />));
    expect(screen.getByText("next")).toBeInTheDocument();
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("活跃")).toBeInTheDocument();
  });

  it("renders port when known", () => {
    const proj = p({ id: "x", portDetected: 3000 });
    render(withRouter(<ProjectCard project={proj} />));
    expect(screen.getByText(":3000")).toBeInTheDocument();
  });

  it("links to detail page using encoded id", () => {
    const proj = p({ id: "photo/virtual-try-on" });
    render(withRouter(<ProjectCard project={proj} />));
    const link = screen.getByRole("link") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/project/photo%2Fvirtual-try-on");
  });

  it("uses dim style for archived projects", () => {
    const proj = p({ id: "x", archived: true });
    const { container } = render(withRouter(<ProjectCard project={proj} />));
    expect(container.firstChild).toHaveClass("opacity-60");
  });
});
