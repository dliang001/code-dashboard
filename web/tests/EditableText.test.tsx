import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableText } from "../src/components/EditableText";

describe("EditableText", () => {
  it("renders the value when not editing", () => {
    render(<EditableText value="hello" onSave={() => {}} />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("clicking ✎ enters edit mode showing a textarea", async () => {
    render(<EditableText value="x" onSave={() => {}} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /编辑/i }));
    expect(screen.getByRole("textbox")).toHaveValue("x");
  });

  it("Save button calls onSave with edited value and exits edit mode", async () => {
    const onSave = vi.fn();
    render(<EditableText value="old" onSave={onSave} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /编辑/i }));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "new");
    await user.click(screen.getByRole("button", { name: /保存/i }));
    expect(onSave).toHaveBeenCalledWith("new");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("Cancel exits edit mode without calling onSave", async () => {
    const onSave = vi.fn();
    render(<EditableText value="old" onSave={onSave} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /编辑/i }));
    await user.click(screen.getByRole("button", { name: /取消/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders empty placeholder when value is empty", () => {
    render(<EditableText value="" onSave={() => {}} placeholder="点击补充" />);
    expect(screen.getByText("点击补充")).toBeInTheDocument();
  });
});
