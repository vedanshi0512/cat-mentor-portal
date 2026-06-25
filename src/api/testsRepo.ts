import { getJsonFile } from './githubClient';
import { updateJsonFileWithRetry } from './optimisticUpdate';
import type { AppCredentials } from '@/types/auth';
import type { Test, TestsFile } from '@/types/test';

const TESTS_PATH = 'data/tests.json';
const EMPTY_TESTS: TestsFile = { version: 1, tests: [] };

export async function fetchAllTests(creds: AppCredentials): Promise<Test[]> {
  const result = await getJsonFile<TestsFile>(creds, TESTS_PATH);
  return result?.data.tests ?? [];
}

export async function upsertTest(creds: AppCredentials, test: Test): Promise<Test[]> {
  const result = await updateJsonFileWithRetry(
    creds,
    TESTS_PATH,
    EMPTY_TESTS,
    (current) => {
      const next = structuredClone(current);
      const idx = next.tests.findIndex((t) => t.id === test.id);
      if (idx >= 0) next.tests[idx] = test;
      else next.tests.push(test);
      return next;
    },
    `Save test "${test.name}"`
  );
  return result.tests;
}

export async function deleteTest(creds: AppCredentials, testId: string): Promise<Test[]> {
  const result = await updateJsonFileWithRetry(
    creds,
    TESTS_PATH,
    EMPTY_TESTS,
    (current) => ({ ...current, tests: current.tests.filter((t) => t.id !== testId) }),
    `Delete test ${testId}`
  );
  return result.tests;
}
