import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider, useLang } from "@app/i18n.js";

function Probe() {
  const { t, lang, setLang, tierName, tError } = useLang();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="plain">{t("app.retry")}</span>
      <span data-testid="params">{t("record.remaining", { n: 2 })}</span>
      <span data-testid="tier">{tierName("gold")}</span>
      <span data-testid="known-error">{tError("NOT_MEMBER", "nguyên văn của máy chủ")}</span>
      <span data-testid="unknown-error">{tError("LẠ_HOẮC", "nguyên văn của máy chủ")}</span>
      <button onClick={() => setLang(lang === "vi" ? "en" : "vi")}>đổi</button>
    </div>
  );
}

function renderProbe(search = "?lang=vi") {
  window.history.replaceState(null, "", search);
  localStorage.clear();
  return render(
    <LangProvider>
      <Probe />
    </LangProvider>,
  );
}

describe("i18n", () => {
  it("lấy ngôn ngữ từ tham số URL", () => {
    renderProbe("?lang=en");
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
    expect(screen.getByTestId("plain")).toHaveTextContent("Try again");
  });

  it("thay tham số trong chuỗi", () => {
    renderProbe();
    expect(screen.getByTestId("params")).toHaveTextContent("còn 2");
  });

  it("dịch tên trình độ theo mã hạng, không theo chữ máy chủ gửi xuống", () => {
    renderProbe();
    expect(screen.getByTestId("tier")).toHaveTextContent("Vàng");
  });

  it("lỗi có bản dịch thì dùng bản dịch, không có thì giữ nguyên văn máy chủ", () => {
    renderProbe();
    expect(screen.getByTestId("known-error")).toHaveTextContent("Bạn không ở trong workspace này.");
    expect(screen.getByTestId("unknown-error")).toHaveTextContent("nguyên văn của máy chủ");
  });

  it("đổi ngôn ngữ và nhớ lựa chọn", async () => {
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "đổi" }));
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
    expect(localStorage.getItem("ranking.lang")).toBe("en");
  });
});
