help: ## Shows this help
	@echo "$$(grep -h '#\{2\}' $(MAKEFILE_LIST) | sed 's/: #\{2\} /	/' | column -t -s '	')"

install: ## Install prompts
	cd ~/.claude && ln -sf $(PWD)/CLAUDE.md
	cd ~/.claude && ln -sf $(PWD)/standards
	cd ~/.claude && ln -sf $(PWD)/skills
	ln -s ~/Sync/prompts/commands ~/.omp/agent/commands
	ln -s ~/Sync/prompts/omp/agents/hooks ~/.omp/agent/hooks

update-user-metrics: ## Re-vendor omp/agents/hooks/lib/user-metrics.ts from @oh-my-pi/omp-stats
	rm -f omp/agents/hooks/lib/user-metrics.ts
	$(MAKE) omp/agents/hooks/lib/user-metrics.ts

omp/agents/hooks/lib/user-metrics.ts:
	curl -fsSL https://unpkg.com/@oh-my-pi/omp-stats/src/user-metrics.ts -o /tmp/omp-stats-user-metrics.ts
	printf '/**\n * Vendored from @oh-my-pi/omp-stats src/user-metrics.ts.\n *\n * Dynamic-importing the published package from the bun global store is not\n * replicable (it depends on a manual `bun add -g` that the Makefile does not\n * perform). Copied here in full so extra-statusline.ts has no external\n * runtime dependency. Re-vendor with `make update-user-metrics` if the\n * upstream heuristics change.\n */\n\n' > $@
	cat /tmp/omp-stats-user-metrics.ts >> $@
	rm /tmp/omp-stats-user-metrics.ts
