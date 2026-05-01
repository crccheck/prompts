# cmux

A terminal multiplexer and workspace manager controlled via Unix socket.

## When to use cmux

- When you need to run something in a separate terminal (e.g., a dev server, background process)
- When the user asks you to open, split, or manage terminal panes/workspaces
- When you need to interact with a browser (cmux has a built-in browser with Playwright-style commands)
- When you need to read what's on screen in another terminal

## Key commands

```
# Workspace management
cmux <path>                          # Open directory in new workspace
cmux new-workspace --cwd <path>      # Create workspace
cmux list-workspaces                 # List all workspaces
cmux select-workspace --workspace <ref>
cmux close-workspace --workspace <ref>

# Pane/split management
cmux new-split <left|right|up|down>  # Split current pane
cmux new-pane --type <terminal|browser>
cmux list-panes
cmux focus-pane --pane <ref>

# Terminal I/O
cmux send <text>                     # Send text to a surface
cmux send-key <key>                  # Send a keystroke (e.g., Enter, Ctrl-c)
cmux read-screen                     # Read current terminal output
cmux read-screen --scrollback        # Include scrollback buffer

# Built-in browser
cmux browser open [url]              # Open browser pane
cmux browser goto <url>              # Navigate
cmux browser snapshot                # Get accessibility tree / DOM snapshot
cmux browser click <selector>        # Click element
cmux browser type <selector> <text>  # Type into element
cmux browser fill <selector> [text]  # Fill input (empty clears)
cmux browser screenshot [--out path] # Take screenshot
cmux browser eval <script>           # Run JavaScript
cmux browser wait --selector <css>   # Wait for element

# Notifications
cmux notify --title <text> [--body <text>]

# Markdown viewer
cmux markdown open <path>            # View markdown with live reload

# Misc
cmux tree                            # Show workspace/pane/surface tree
cmux read-screen --surface <ref>     # Read specific surface
```

## Addressing

Commands accept UUIDs, short refs (`window:1`, `workspace:2`, `pane:3`, `surface:4`), or indexes. Environment variables `CMUX_WORKSPACE_ID` and `CMUX_SURFACE_ID` are auto-set in cmux terminals and used as defaults.
