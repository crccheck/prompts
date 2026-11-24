# Python tests

These rules apply to tests written with unittest or pytest

- Test names:
  1. Unit tests should immediately start with the exact name of the function/method: `test_<method name>_<test name>`
     - If the entire test case is only for one method, you can omit the method name: `test_<test name>`
  2. The `<test name>` should describe behavior including the expected outcome and form a complete consise coherent thought
  3. Only in rare cases, write a docstring to describe the test if it won't fit in the name
- Tests must resemble each other so readers can understand that differences are intentional
