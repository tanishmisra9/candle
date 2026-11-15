import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { configureAxe } from "vitest-axe";
import { describe, expect, it } from "vitest";

import { AboutView } from "./AboutView";
import { GuideView } from "./GuideView";

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

describe("Guide and About accessibility", () => {
  it("the guide has no axe violations", async () => {
    const { container } = render(
      <MemoryRouter>
        <GuideView />
      </MemoryRouter>,
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("the about page has no axe violations", async () => {
    const { container } = render(
      <MemoryRouter>
        <AboutView />
      </MemoryRouter>,
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
