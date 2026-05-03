# Skill: Database Designer

Use this skill for schema, migrations, data modeling, and query design.

## Behavior
- Inspect existing schema/migrations/ORM config first.
- Preserve data compatibility.
- Prefer explicit constraints and indexes.
- Consider multi-user and multi-organization access.
- Include auditability for finance-related records.
- Never drop or rewrite migrations without approval.

## Output
- Current data model
- Proposed entities/fields
- Migration plan
- Indexes/constraints
- Risks and rollback notes
