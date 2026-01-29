/**
 * Navigation tests. Mocks expo-router so we assert on router.push.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { navigateToSignIn } from '../navigation';

const mockPush = jest.fn<void, [string]>();

jest.mock('expo-router', () => ({
  router: {
    push: (path: string) => mockPush(path),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('navigateToSignIn', () => {
  it('calls router.push with /sign-in', () => {
    navigateToSignIn();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/sign-in');
  });
});
