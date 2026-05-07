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
        <Route
          path="/"
          element={
            <>
              <FilterBar
                languages={["node", "python", "docker"]}
                statusCounts={{ all: 10, running: 3, idle: 6, error: 1 }}
                archivedCount={2}
              />
              <Probe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FilterBar", () => {
  it("typing in search box updates URL ?q=", async () => {
    setup();
    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox"), "hair");
    expect(screen.getByTestId("qs").textContent).toContain("q=hair");
  });

  it("clicking a language chip updates URL", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /python/i }));
    expect(screen.getByTestId("qs").textContent).toContain("lang=python");
  });

  it("renders status + archived chips with counts", () => {
    setup();
    expect(screen.getByRole("button", { name: /运行中 3/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /含归档 2/ })).toBeInTheDocument();
  });
});
