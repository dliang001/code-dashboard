import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    render(withRouter(<ProjectCard project={proj} runState="idle" />));
    expect(screen.getByText("photo")).toBeInTheDocument();
    expect(screen.getByText("Sample photo project.")).toBeInTheDocument();
  });

  it("prefers user description over auto", () => {
    const proj = p({ id: "x", description: "user wrote this", descriptionAuto: "auto wrote that" });
    render(withRouter(<ProjectCard project={proj} runState="idle" />));
    expect(screen.getByText("user wrote this")).toBeInTheDocument();
    expect(screen.queryByText("auto wrote that")).not.toBeInTheDocument();
  });

  it("renders frameworks and tags", () => {
    const proj = p({ id: "x", frameworks: ["next", "react"], tags: ["活跃"] });
    render(withRouter(<ProjectCard project={proj} runState="idle" />));
    expect(screen.getByText("next")).toBeInTheDocument();
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("活跃")).toBeInTheDocument();
  });

  it("links to detail page using encoded id", () => {
    const proj = p({ id: "photo/virtual-try-on" });
    render(withRouter(<ProjectCard project={proj} runState="idle" />));
    const link = screen.getAllByRole("link")[0] as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/project/photo%2Fvirtual-try-on");
  });

  it("uses dim style for archived projects", () => {
    const proj = p({ id: "x", archived: true });
    const { container } = render(withRouter(<ProjectCard project={proj} runState="idle" />));
    expect(container.firstChild).toHaveClass("opacity-60");
  });

  it("shows red conflict banner when isInConflict + peers given", () => {
    const proj = p({ id: "a", portDetected: 3000 });
    render(withRouter(<ProjectCard project={proj} runState="idle" isInConflict={true} conflictPeerIds={["b", "c"]} />));
    expect(screen.getByText(/端口 :3000 与 b、c 冲突/)).toBeInTheDocument();
  });

  it("renders expand button when children given, no button when leaf", () => {
    const parent = p({ id: "p", name: "p" });
    const child = p({ id: "p/c", name: "c", parent: "p" });
    render(withRouter(<ProjectCard project={parent} runState="idle" children={[child]} />));
    expect(screen.getByRole("button", { name: /1 个子项目/ })).toBeInTheDocument();
  });

  it("expand button reveals child cards", async () => {
    const parent = p({ id: "p", name: "parent" });
    const child = p({ id: "p/c", name: "child-name" });
    render(withRouter(<ProjectCard project={parent} runState="idle" children={[child]} />));
    const user = userEvent.setup();
    expect(screen.queryByText("child-name")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /1 个子项目/ }));
    expect(screen.getByText("child-name")).toBeInTheDocument();
  });

  it("renders real run state badge", () => {
    const proj = p({ id: "x" });
    render(withRouter(<ProjectCard project={proj} runState="running-external" />));
    expect(screen.getByText(/运行中（外）/)).toBeInTheDocument();
  });
});
