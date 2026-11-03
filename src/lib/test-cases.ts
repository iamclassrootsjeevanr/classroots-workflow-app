/** One row of the Test cases list (a test case with its latest result). */
export type CaseRow = {
  /** Test case id, e.g. TC_001. */
  id: string;
  title: string;
  scenario: string;
  expected: string;
  steps: string;
  /** Default priority of the test case. */
  priority: string;
  /** Id of the shared test case row (edits go there). */
  caseId: string;
  versionCount: number;
  latestVersion: string;
  latestStatus: string;
  latestColor: string;
};
