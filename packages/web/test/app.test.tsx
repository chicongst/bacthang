import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RankingApp } from "@app/RankingApp.js";
import { makeAccount, makeBoard, makePlatform } from "./fake.js";

function renderApp(fake = makePlatform()) {
  window.history.replaceState(null, "", "?lang=vi");
  localStorage.clear();
  render(<RankingApp platform={fake.platform} />);
  return fake;
}

describe("the tournament banner", () => {
  it("stays hidden until a workspace has a tournament name", async () => {
    renderApp(makePlatform({ board: makeBoard() }));

    expect(await screen.findByRole("tab", { name: /Bảng/ })).toBeInTheDocument();
    expect(document.querySelector(".plate")).toBeNull();
  });

  it("shows the name as a heading when there is one", async () => {
    const board = makeBoard();
    board.workspace.tournamentName = "Spring Championship 2026";
    renderApp(makePlatform({ board }));

    expect(await screen.findByRole("heading", { name: "Spring Championship 2026" })).toBeInTheDocument();
  });
});

describe("app shell", () => {
  it("shows the sign-in screen when signed out", async () => {
    renderApp(makePlatform({ token: null }));
    expect(await screen.findByRole("button", { name: /Đăng nhập bằng Discord/ })).toBeInTheDocument();
  });

  it("loads the board of the active workspace once signed in", async () => {
    const fake = renderApp();
    expect(await screen.findByText("Test Club")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Bảng/ })).toHaveAttribute("aria-selected", "true");
    expect(fake.api.board).toHaveBeenCalledWith("test-token", 7);
  });

  it("goes straight to find-or-create when in no workspace", async () => {
    renderApp(makePlatform({ account: makeAccount({ workspaces: [] }) }));
    expect(await screen.findByRole("heading", { name: "Vào một workspace" })).toBeInTheDocument();
  });

  it("re-picking the open workspace reloads the board instead of hanging on loading", async () => {
    const fake = renderApp();
    await screen.findByText("Test Club");
    const before = fake.api.board.mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: /Test Club/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Test Club/ }));

    await waitFor(() => expect(fake.api.board.mock.calls.length).toBeGreaterThan(before));
    expect(await screen.findByText("Test Club")).toBeInTheDocument();
    expect(screen.queryByText("Đang tải…")).not.toBeInTheDocument();
  });

  it("only fetches recent matches when that tab opens", async () => {
    const fake = renderApp();
    await screen.findByText("Test Club");
    expect(fake.api.recent).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("tab", { name: /Gần đây/ }));
    await waitFor(() => expect(fake.api.recent).toHaveBeenCalledWith("test-token", 7));
  });

  it("the rules tab shows the limits the server sent", async () => {
    const board = makeBoard();
    board.rules.dailyLimitPerPair = 4;
    const fake = renderApp(makePlatform({ board }));
    await screen.findByText("Test Club");

    await userEvent.click(screen.getByRole("tab", { name: /Luật/ }));
    expect(await screen.findByText("Mỗi cặp 4 trận một ngày")).toBeInTheDocument();
    expect(fake.api.board).toHaveBeenCalled();
  });
});
