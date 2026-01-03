---
name: django-upgrade
description: Upgrades Django code using the django-upgrade tool
---

# Django Upgrade Skill

## Tool Installation

Install and upgrade django-upgrade with:

```bash
uv tool install django-upgrade
uv tool upgrade django-upgrade
```

## Usage

1. List available fixers:

```bash
django-upgrade --list-fixers
```

2. Run a specific fixer:

```bash
git ls-files -z -- 'src/**/*.py' | xargs -0r django-upgrade --only django_urls
```

## Available Fixers (django-upgrade 1.29.1)

- [ ] admin_allow_tags
- [ ] admin_decorators
- [ ] admin_lookup_needs_distinct
- [ ] admin_register
- [ ] assert_form_error
- [ ] assert_set_methods
- [ ] check_constraint_condition
- [ ] compatibility_imports
- [ ] crypto_get_random_string
- [ ] default_app_config
- [ ] default_auto_field
- [ ] django_urls
- [ ] email_validator
- [ ] format_html
- [ ] forms_model_multiple_choice_field
- [ ] index_together
- [ ] mail_api_kwargs
- [ ] management_commands
- [ ] model_field_choices
- [ ] null_boolean_field
- [ ] on_delete
- [ ] password_reset_timeout_days
- [ ] postgres_aggregate_order_by
- [ ] postgres_float_range_field
- [ ] queryset_paginator
- [ ] request_headers
- [ ] request_user_attributes
- [ ] settings_admins_managers
- [ ] settings_database_postgresql
- [ ] settings_forms_urlfield_assume_https
- [ ] settings_storages
- [ ] signal_providing_args
- [ ] staticfiles_find_all
- [ ] stringagg
- [ ] test_http_headers
- [ ] testcase_databases
- [ ] timezone_fixedoffset
- [ ] use_l10n
- [ ] utils_encoding
- [ ] utils_http
- [ ] utils_text
- [ ] utils_timezone
- [ ] utils_translation
- [ ] versioned_branches
- [ ] versioned_test_skip_decorators
