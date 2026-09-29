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
      <span data-testid="known-error">{tError("NOT_MEMBER", "raw server message")}</span>
      <span data-testid="unknown-error">{tError("UNKNOWN_CODE", "raw server message")}</span>
      <button onClick={() => setLang(lang === "vi" ? "en" : "vi")}>switch</button>
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
  it("takes the language from the URL parameter", () => {
    renderProbe("?lang=en");
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
    expect(screen.getByTestId("plain")).toHaveTextContent("Try again");
  });

  it("substitutes parameters into a string", () => {
    renderProbe();
    expect(screen.getByTestId("params")).toHaveTextContent("còn 2");
  });

  it("translates tier names from the id, not from the server text", () => {
    renderProbe();
    expect(screen.getByTestId("tier")).toHaveTextContent("Vàng");
  });

  it("uses a translation when the error code has one, otherwise the server text", () => {
    renderProbe();
    expect(screen.getByTestId("known-error")).toHaveTextContent("Bạn không ở trong workspace này.");
    expect(screen.getByTestId("unknown-error")).toHaveTextContent("raw server message");
  });

  it("switches language and remembers the choice", async () => {
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "switch" }));
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
    expect(localStorage.getItem("ranking.lang")).toBe("en");
  });
});
