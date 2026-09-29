import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@app/i18n.js";
import { Record } from "@app/views/Record.js";
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

describe("ghi trận", () => {
  it("chưa chọn đối thủ thì chưa hiện phần kết quả", () => {
    renderRecord();
    expect(screen.getByText("Chọn đối thủ trước, rồi mới chọn kết quả.")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Tôi thắng/ })).not.toBeInTheDocument();
  });

  it("chọn đối thủ xong mới hiện thắng thua", async () => {
    renderRecord();
    await userEvent.click(screen.getByRole("radio", { name: /Đối Thủ/ }));
    expect(screen.getByRole("radio", { name: /Tôi thắng/ })).toBeInTheDocument();
    expect(screen.getByText("với Đối Thủ")).toBeInTheDocument();
  });

  it("người hết lượt bị khóa, không chọn được", async () => {
    const me = makeBoard().players[0]!;
    const hetLuot = makePlayer({ id: 2, rank: 2, name: "Hết Lượt", remainingWithMe: 0 });
    const conLuot = makePlayer({ id: 3, rank: 3, name: "Còn Lượt", remainingWithMe: 2 });
    renderRecord([me, hetLuot, conLuot]);

    const nut = screen.getByRole("radio", { name: /Hết Lượt/ });
    expect(nut).toBeDisabled();
    expect(nut).toHaveTextContent("hết lượt");
    expect(screen.getByRole("radio", { name: /Còn Lượt/ })).toBeEnabled();
  });

  it("đổi sang đối thủ khác thì xóa kết quả đã chọn, tránh ghi nhầm người", async () => {
    const me = makeBoard().players[0]!;
    const a = makePlayer({ id: 2, rank: 2, name: "Người A" });
    const b = makePlayer({ id: 3, rank: 3, name: "Người B" });
    const onSubmit = renderRecord([me, a, b]);

    await userEvent.click(screen.getByRole("radio", { name: /Người A/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Tôi thắng/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Người B/ }));

    expect(screen.getByRole("button", { name: "Chọn thắng hay thua" })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hết lượt với tất cả mọi người thì báo nghỉ", () => {
    const me = makeBoard().players[0]!;
    const a = makePlayer({ id: 2, name: "Người A", remainingWithMe: 0 });
    renderRecord([me, a]);
    expect(screen.getByText("Hôm nay bạn đã đánh đủ lượt với tất cả mọi người.")).toBeInTheDocument();
  });
});
