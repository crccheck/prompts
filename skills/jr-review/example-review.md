# Example Junior Review

This is an example of what a `/jr-review` output should look like.

---

## Tribal Knowledge Issues

### Issue #1: Missing Context

**Location**: `src/utils.py:44`

**Category**: Missing Context

**Issue**: The `stacklevel=3` parameter is used without explanation. The magic number "3" has no context for why this specific value is needed.

**My Question**: "What does stacklevel=3 mean? Why 3 and not 2 or 4? How would I know what value to use if I needed to add another warning?"

**Suggested Fix**: Add a comment explaining that stacklevel controls which frame in the call stack the warning appears to come from, and why 3 is correct for this case (e.g., "stacklevel=3 shows warning at the caller's caller, skipping our helper functions").

---

### Issue #2: Undocumented Convention

**Location**: `src/utils.py:20`

**Category**: Undocumented Conventions

**Issue**: A global variable `_SETTING_WARNING_EMITTED` is used to track whether a warning has been shown, but there's no explanation of why this needs to be global state rather than per-instance or why this anti-pattern was chosen.

**My Question**: "Why is this a module-level global? Could this cause issues in testing or with multiple Django apps? Why not track this per-instance or use a different pattern?"

**Suggested Fix**: Add a comment explaining why global state is acceptable here (e.g., "Global is acceptable because we only want to warn once per Python process, regardless of how many times the function is called").

---

### Issue #3: Implicit Dependencies

**Location**: `src/utils.py:211-212`

**Category**: Implicit Dependencies

**Issue**: The code silently removes `href` from attrs with a comment asking "should an exception be raised instead?" This suggests there's a constraint, but it's not clear what breaks if href is set or why it's forbidden.

**My Question**: "Why can't href be set? What breaks if someone tries? Why do we silently remove it rather than raising an error to tell the developer they're doing something wrong?"

**Suggested Fix**: Replace the comment with an explanation of *why* href isn't allowed (e.g., "href is auto-generated from the tool name and object ID, so custom hrefs would be ignored/broken"). Then the silent removal makes more sense as a safeguard.

---

### Issue #4: Unclear Business Logic

**Location**: `src/utils.py:50-52`

**Category**: Unclear Business Logic

**Issue**: The `get_default_button_type()` function returns either "a" or "form" based on the HTTP method, but the connection between these concepts isn't explained. Why does GET→"a" and POST→"form"?

**My Question**: "Why does the HTTP method determine the button type? What's the relationship between GET/POST and a/form? Is 'a' for anchor tags and 'form' for form elements?"

**Suggested Fix**: Add a docstring or comment explaining the web semantics: "GET actions use anchor tags ('a') for simple links, while POST actions require forms for CSRF protection and semantic correctness."

---

### Issue #5: Misleading Variable Name

**Location**: `src/utils.py:189-199`

**Category**: Misleading Variable Names

**Issue**: The method `_get_tool_dict` takes a parameter called `tool_name`, but then uses `tool = getattr(self, tool_name)` and calls it "tool" from then on. The variable name `tool` suggests it's the tool function, but it's actually retrieving it by name. This naming anti-pattern creates confusion about what's a string and what's a callable.

**My Question**: "Is `tool_name` always a string? Is `tool` always a callable method? The relationship between these isn't clear from the names."

**Suggested Fix**: Consider renaming to make the types clearer, e.g., `tool_method` or `tool_func` for the retrieved callable, making it obvious that we're going from a string name to a function object.

---

## Also Noted (covered by /review)

**Style:**
- Line 208: Comment mentions "kinda awkward and due for a refactor for readability" - this technical debt comment should probably be tracked as a TODO or issue rather than left inline

**Potential inconsistency:**
- Lines 211-218: Both href and title are popped with similar "should an exception be raised?" comments, suggesting uncertainty in the design that might need resolution
