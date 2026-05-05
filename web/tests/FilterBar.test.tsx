import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { FilterBar } from "../src/components/FilterBar";

function Probe() {
  const [params] = useSearchParams();
  return <span data-testid="qs">{params.toString()}</span>;
}

function setup(initial = "/") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/" element={<><FilterBar languages={["node", "python", "docker"]} counts={{ all: 10, archived: 2, conflicts: 1 }} /><Probe /></>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("FilterBar", () => {
  it("typing in search box updates URL ?q=", async () => {
    setup();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/搜索/i), "hair");
    expect(screen.getByTestId("qs").textContent).toContain("q=hair");
  });

  it("clicking a language chip updates URL", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /python/i }));
    expect(screen.getByTestId("qs").textContent).toContain("lang=python");
  });

  it("toggling group switches URL ?group=1 on/off", async () => {
    setup();
    const user = userEvent.setup();
    const toggle = screen.getByRole("button", { name: /分组/i });
    await user.click(toggle);
    expect(screen.getByTestId("qs").textContent).toContain("group=1");
    await user.click(toggle);
    expect(screen.getByTestId("qs").textContent).not.toContain("group=1");
  });

  it("renders count chips", () => {
    setup();
    expect(screen.getByText(/全部 10/)).toBeInTheDocument();
    expect(screen.getByText(/已归档 2/)).toBeInTheDocument();
  });
});
