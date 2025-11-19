# Worktree

## Setup the worktree

```
./worktrees.sh setup \
  --branches feat/api_bearer_tokens_auth \
  --db-url postgresql://pi:password@localhost:5432/nextsololedger
```

## Clean the worktree

```
./worktrees.sh clean --all --yes
```

## merge

```
./worktrees.sh merge --branches feat/api_bearer_tokens_auth --into main
```

# create wireframes based on plan

Based on this plan outlined at @notes/plan.md, give me the ux flow map and screen-by-screen content using the ASCII wireframe. Put it at @notes/wireframes.md. IMPORTANT: Always wrap codeblocks with triple backticks around the wireframes for proper formatting.

# create wireframes based on plan (copilot version)

Based on this plan outlined at #notes/plan.md, give me the ux flow map and screen-by-screen content using the ASCII wireframe. Put it at #notes/wireframes.md. IMPORTANT: Always wrap codeblocks with triple backticks around the wireframes for proper formatting.

---

Put the plan at . You have my permission to edit files nows.

Then, give me the ux flow map and screen-by-screen content using the ASCII wireframe.

Put it at

IMPORTANT: Always wrap codeblocks with triple backticks around the wireframes for proper formatting.

# Implementation

Read the plan at @notes/plan.md and @notes/wireframes.md, and implement the plan accordingly. Use the wireframes as a guide for the implementation.

Please use the "build-insights-logger" skill to automatically log meaningful insights, discoveries, and decisions during coding session.

# Review

Please read the git diff, and review the code changes to see if the implementation is correct and follows the plan @notes/plan.md and wireframes @notes/wireframes.md, correctly.

# docs to merge back to main

The current directory is a worktree. We will be merging the changes made here back to main. Please create documentation that includes the summary of changes, new features added, and any important notes for users or developers, the summary should be short and consice. And then outline the steps that needs to be taken AFTER merging back to main has been done to ensure that the main branch is fully functional and up-to-date. Include any database migrations, environment variable updates, or other necessary configurations. Put the documentation at @notes/post_merge_instructions.md.

# Ask me (copilot)

Read the codebase, and help me come up with a plan to implement everything above.

Make sure to include a short description for this plan in paragraph format at the beginning of the plan.

IMPORTANT: DON'T WRITE OR EDIT ANY FILES UNTIL I TELL YOU TO.

Use web search if you need to find solutions to problems you encounter, or look for the latest documentation.

Ask me clarifying questions until you are 95% confident you can complete this task successfully.

a. If the question is about choosing different options, please provide me with a list of options to choose from. Mark the option with a clear label, like a, b, c, etc.
b. If the question need custom input that is not in the list of options, please ask me to provide the custom input.

Always mark each question with a number, like 1/, 2/, 3/, etc. so that I can easily refer to the question number when I answer.

For each question, add your recommendation (with reason why) below the options. This would help me in making a better decision.

Once you are 95% confident you can complete this task successfully, put the plan in a code block so that I can easily copy it.

# Identify the current implementation gaps

Please read the codebase and cross check with the #file:requirements.md and #file:user_stories.md, mark those that already completed as "completed". If it's partially completed, then list out which part is completed, which part is not. If it's not completed yet, left it as-it.

# Next in-line

Based on the attached requirements and user stories, I want to know what should I build next. Focus on small, granular tasks that can be completed quickly and testably.

The size of “granular task” can vary based on the complexity of the project., but generally, it should be small enough to be completed within 3 - 5 hours as long as it's coherent and adds value to the overall project.

The idea is to add new features incrementally while ensuring each addition is stable and does not introduce bugs.

Please read the codebase and understand the current implementation and suggest to me what should I do next.

Ask me clarifying questions until you are 95% confident you can complete this task successfully.

a. If the question is about choosing different options, please provide me with a list of options to choose from. Mark the option with a clear label, like a, b, c, etc.
b. If the question need custom input that is not in the list of options, please ask me to provide the custom input.

Always mark each question with a number, like 1/, 2/, 3/, etc. so that I can easily refer to the question number when I answer.

For each question, add your recommendation (with reason why) below the options. This would help me in making a better decision.

# Insights Logger

Please use the "build-insights-logger" skill to automatically log meaningful insights, discoveries, and decisions during coding session.
