# Code style

- Avoid comments. Write self-documenting code instead. Comments are only for antipatterns
- Use modern syntax for new code instead of matching existing style except when
  there's a comment saying we need consistency (for example, forked code that
  needs to resemble upstream). Old style code will be a deliberate code smell
  to indicate that it is old.
- Don't suggest DRY refactors
- Do not write trivial helper functions. Keep one-line or single-use logic inline unless the helper names a real domain concept used in multiple places.
- Avoid single-letter variable names. Use descriptive names except for:
  - Established mathematical notation, such as `x`, `y`, and `z` for coordinates or `i` and `j` for matrix indices
  - `i` or `j` for an iterator on one line; use `idx` if it spans more than one line
  - `x` for an item in an iterable
  - `a` and `b` for paired values, such as in sorting or reduction
  - `n` for a total or count
