# Tests

- If a test is over 4 lines, split it into arrange, act, and assert sections when possible. This may not be possible with context managers or event-driven code
- Avoid tautological tests that only verify values or behavior established by the test setup. Test the code's observable behavior against an independent expected result

## Prefer literal values

- Prefer literal expected values when in doubt. Use them for regression tests so the test documents the specific case and its values are easy to find, copy, and understand
- Use a derived value when a literal would be a maintenance burden or when the test should document a relationship to another value
- When the expected value is not deterministic, assert the relationship and add a sanity check that catches a false match, such as both sides being zero
