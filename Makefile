help: ## Shows this help
	@echo "$$(grep -h '#\{2\}' $(MAKEFILE_LIST) | sed 's/: #\{2\} /	/' | column -t -s '	')"

install: ## Install prompts
	cd ~/.claude && ln -sf $(PWD)/CLAUDE.md
	cd ~/.claude && ln -sf $(PWD)/tasks
	cd ~/.claude && ln -sf $(PWD)/skills
