import { describe, expect, it } from "vitest";

import {
  displayTitle,
  formatCitation,
  formatLeadAuthor,
  formatMonthYear,
  formatParticipants,
  normalizeStatus,
} from "./formatters";

describe("normalizeStatus", () => {
  it.each([
    ["RECRUITING", "RECRUITING"],
    ["Active, not recruiting", "ACTIVE_NOT_RECRUITING"],
    ["  Recruiting ", "RECRUITING"], // stray whitespace must not leave a trailing underscore
    ["not-yet-recruiting", "NOT_YET_RECRUITING"],
    ["", ""],
    [null, ""],
  ] as const)("%j -> %j", (input, expected) => {
    expect(normalizeStatus(input)).toBe(expected);
  });
});

describe("formatParticipants", () => {
  it.each([
    [17, "17 participants"],
    [1, "1 participant"], // N-of-1 and first-in-human gene-therapy studies are common here
    [0, "None enrolled"], // a withdrawn trial printed "0 participants", which reads like an error
    [null, "Participants not listed"],
  ])("%s -> %s", (n, expected) => {
    expect(formatParticipants(n)).toBe(expected);
  });
});

describe("formatMonthYear", () => {
  it("runs in a western timezone, so a local-time formatter would be caught", () => {
    expect(new Date("2011-10-01").getDate()).toBe(30); // UTC midnight is the previous evening in Los Angeles
  });

  it.each([
    ["2011-10-01", "Oct 2011"], // a local-time formatter prints "Sep 2011" here
    ["2017-10-01", "Oct 2017"],
    ["2021-01-01", "Jan 2021"], // ... and "Dec 2020" here
    ["2011-10", "Oct 2011"],
    ["2011", "Jan 2011"],
  ])("%s -> %s", (value, expected) => {
    expect(formatMonthYear(value)).toBe(expected);
  });

  it("says Unknown for a missing date and passes through a value it cannot parse", () => {
    expect(formatMonthYear(null)).toBe("Unknown");
    expect(formatMonthYear("not a date")).toBe("not a date");
  });
});

describe("formatParticipants grouping", () => {
  it("groups thousands in the viewer's locale (20000 and 1178 were unreadable)", () => {
    expect(formatParticipants(1178)).toBe(`${new Intl.NumberFormat().format(1178)} participants`);
    expect(formatParticipants(1178)).not.toBe("1178 participants");
    expect(formatParticipants(20000)).not.toBe("20000 participants");
  });
});

describe("formatLeadAuthor and formatCitation", () => {
  it.each([
    [["Smith, J", "Lee, K"], "Smith et al."],
    [["Smith, J"], "Smith"], // the dialog printed "Smith et al." for a sole author
    [["MacLaren R"], "MacLaren R"],
    [[], "Unknown author"],
    [[""], "Unknown author"],
  ])("%j -> %s", (authors, expected) => {
    expect(formatLeadAuthor(authors)).toBe(expected);
  });

  it("is ONE citation format: lead author, year, 'n.d.' when undated", () => {
    expect(formatCitation(["Smith, J", "Lee, K"], "2021-03-01")).toBe("Smith et al., 2021");
    expect(formatCitation(["Smith, J"], "2021-03-01")).toBe("Smith, 2021");
    expect(formatCitation(["Smith, J", "Lee, K"], null)).toBe("Smith et al., n.d."); // the trial's tile used to drop the year
  });
});

describe("displayTitle", () => {
  it.each([
    ["Retinal gene therapy in patients with choroideremia.", "Retinal gene therapy in patients with choroideremia"],
    ["CHOROIDEREMIA.", "CHOROIDEREMIA."], // only after a lowercase letter, digit or bracket
    ["A new approach (phase 1).", "A new approach (phase 1)"],
    ["Outcomes in 2020.", "Outcomes in 2020"],
    ["Care in the U.S.", "Care in the U.S."], // an abbreviation keeps its own full stop
    ["Choroideremia: a review", "Choroideremia: a review"],
    ["Wait...", "Wait..."],
  ])("%s", (title, expected) => {
    expect(displayTitle(title)).toBe(expected);
  });
});
