# Worktree

## Setup the worktree

```
./worktrees.sh setup \
  --branches feat/org_resend_integration \
  --db-url postgresql://pi:password@localhost:5432/nextboilerplate
```

## Clean the worktree

```
./worktrees.sh clean --all --yes
```

## merge

```
./worktrees.sh merge --branches feat/org_resend_integration --into main
```

# create wireframes based on plan

Based on this plan outlined at @notes/plan.md, give me the ux flow map and screen-by-screen content using the ASCII wireframe. Put it at @notes/wireframes.md. IMPORTANT: Always wrap codeblocks with triple backticks around the wireframes for proper formatting.

# create wireframes based on plan (copilot version)

Based on this plan outlined at #notes/plan.md, give me the ux flow map and screen-by-screen content using the ASCII wireframe. Put it at #notes/wireframes.md. IMPORTANT: Always wrap codeblocks with triple backticks around the wireframes for proper formatting.

# Implementation

Read the plan at @notes/plan.md and @notes/wireframes.md, and implement the plan accordingly. Use the wireframes as a guide for the implementation.

# Review

Please read the git diff, and review the code changes to see if the implementation is correct and follows the plan @notes/plan.md and wireframes @notes/wireframes.md, correctly.

# docs to merge back to main

The current directory is a worktree. We will be merging the changes made here back to main. Please create documentation that includes the summary of changes, new features added, and any important notes for users or developers, the summary should be short and consice. And then outline the steps that needs to be taken AFTER merging back to main has been done to ensure that the main branch is fully functional and up-to-date. Include any database migrations, environment variable updates, or other necessary configurations. Put the documentation at @notes/post_merge_instructions.md.
