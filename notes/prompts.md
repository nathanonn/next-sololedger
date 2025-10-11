# Worktree

## Setup the worktree

```
./worktrees.sh setup \
  --branches feat/enhancement_10111126 \
  --db-url postgresql://pi:password@localhost:5432/nextwriter
```

## Clean the worktree

```
./worktrees.sh clean --all --yes
```

## merge

```
./worktrees.sh merge --branches feat/enhancement_10111126 --into main
```

# create wireframes based on plan

Based on this plan outlined at @notes/plan.md, give me the ux flow map and screen-by-screen content using the ASCII wireframe. Put it at @notes/wireframes.md.

# create wireframes based on plan (copilot version)

Based on this plan outlined at #notes/plan.md, give me the ux flow map and screen-by-screen content using the ASCII wireframe. Put it at #notes/wireframes.md.

# Implementation

Read the plan at @notes/plan.md and @notes/wireframes.md, and implement the plan accordingly. Use the wireframes as a guide for the implementation.

# Review

Please read the git diff, and review the code changes to see if the implementation is correct and follows the plan @notes/plan.md and wireframes @notes/wireframes.md, correctly.
