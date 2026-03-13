# Django

## Django tests

- If a test is over 4 lines, split them according to arrange-act-assert if possible (for example, it's not possible in tests with context managers and event driven code)
- Test names:
  1. Unit tests should immediately start with the exact name of the function/method: `test_<method name>_<test name>`
     - If the entire test case is only for one method, you can omit the method name: `test_<test name>`
  2. The `<test name>` should describe behavior including the expected outcome and form a complete consise coherent thought
  3. Only in rare cases, write a docstring to describe the test if it won't fit in the name
- Tests must resemble each other so readers can understand that differences are intentional
