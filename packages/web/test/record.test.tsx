import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@app/i18n.js";
import { Record } from "@app/views/Record/index.js";
import { makeBoard, makePlayer } from "./fake.js";

function renderRecord(players = makeBoard().players, onSubmit = vi.fn(async () => null)) {
  window.history.replaceState(null, "", "?lang=vi");
  localStorage.clear();
  const board = makeBoard();
  render(
    <LangProvider>
      <Record me={board.me} players={players} onSubmit={onSubmit} />
    </LangProvider>,
  );
  return onSubmit;
}

describe("recording a match", () => {
  it("hides the result step until an opponent is picked", () => {
    renderRecord();
    expect(screen.getByText("Chọn đối thủ trước, rồi mới chọn kết quả.")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Tôi thắng/ })).not.toBeInTheDocument();
  });

  it("shows win and loss only after an opponent is picked", async () => {
    renderRecord();
    await userEvent.click(screen.getByRole("radio", { name: /Rival/ }));
    expect(screen.getByRole("radio", { name: /Tôi thắng/ })).toBeInTheDocument();
    expect(screen.getByText("với Rival")).toBeInTheDocument();
  });

  it("an opponent with no matches left is disabled", async () => {
    const me = makeBoard().players[0]!;
    const usedUp = makePlayer({ id: 2, rank: 2, name: "Used Up", remainingWithMe: 0 });
    const hasLeft = makePlayer({ id: 3, rank: 3, name: "Has Left", remainingWithMe: 2 });
    renderRecord([me, usedUp, hasLeft]);

    const button = screen.getByRole("radio", { name: /Used Up/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("hết lượt");
    expect(screen.getByRole("radio", { name: /Has Left/ })).toBeEnabled();
  });

  it("switching opponent clears the chosen result so nothing is recorded against the wrong person", async () => {
    const me = makeBoard().players[0]!;
    const a = makePlayer({ id: 2, rank: 2, name: "Player A" });
    const b = makePlayer({ id: 3, rank: 3, name: "Player B" });
    const onSubmit = renderRecord([me, a, b]);

    await userEvent.click(screen.getByRole("radio", { name: /Player A/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Tôi thắng/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Player B/ }));

    expect(screen.getByRole("button", { name: "Chọn thắng hay thua" })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the done panel when every opponent is used up", () => {
    const me = makeBoard().players[0]!;
    const a = makePlayer({ id: 2, name: "Player A", remainingWithMe: 0 });
    renderRecord([me, a]);
    expect(screen.getByText("Hôm nay bạn đã đánh đủ lượt với tất cả mọi người.")).toBeInTheDocument();
  });
});
