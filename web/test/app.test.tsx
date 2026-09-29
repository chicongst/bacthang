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

describe("vỏ ứng dụng", () => {
  it("chưa đăng nhập thì hiện màn đăng nhập", async () => {
    renderApp(makePlatform({ token: null }));
    expect(await screen.findByRole("button", { name: /Đăng nhập bằng Discord/ })).toBeInTheDocument();
  });

  it("đăng nhập rồi thì nạp bảng của workspace đang mở", async () => {
    const fake = renderApp();
    expect(await screen.findByText("CLB Thử")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Bảng/ })).toHaveAttribute("aria-selected", "true");
    expect(fake.api.board).toHaveBeenCalledWith("token-thử", 7);
  });

  it("chưa ở workspace nào thì vào thẳng màn tìm hoặc tạo", async () => {
    renderApp(makePlatform({ account: makeAccount({ workspaces: [] }) }));
    expect(await screen.findByRole("heading", { name: "Vào một workspace" })).toBeInTheDocument();
  });

  it("chọn lại đúng workspace đang mở vẫn nạp lại bảng, không kẹt ở màn đang tải", async () => {
    const fake = renderApp();
    await screen.findByText("CLB Thử");
    const lanDau = fake.api.board.mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: /CLB Thử/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /CLB Thử/ }));

    await waitFor(() => expect(fake.api.board.mock.calls.length).toBeGreaterThan(lanDau));
    expect(await screen.findByText("CLB Thử")).toBeInTheDocument();
    expect(screen.queryByText("Đang tải…")).not.toBeInTheDocument();
  });

  it("đổi tab sang Gần đây thì mới gọi danh sách trận", async () => {
    const fake = renderApp();
    await screen.findByText("CLB Thử");
    expect(fake.api.recent).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("tab", { name: /Gần đây/ }));
    await waitFor(() => expect(fake.api.recent).toHaveBeenCalledWith("token-thử", 7));
  });

  it("tab Luật hiện đúng mốc điểm máy chủ gửi xuống", async () => {
    const board = makeBoard();
    board.rules.dailyLimitPerPair = 4;
    const fake = renderApp(makePlatform({ board }));
    await screen.findByText("CLB Thử");

    await userEvent.click(screen.getByRole("tab", { name: /Luật/ }));
    expect(await screen.findByText("Mỗi cặp 4 trận một ngày")).toBeInTheDocument();
    expect(fake.api.board).toHaveBeenCalled();
  });
});
