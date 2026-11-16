# StudyOS V3.5

## What's new
- Added an optional estimated-time-remaining field to assignment creation and editing.
- Start Here now ranks unfinished assignments using deadline urgency, priority, and estimated remaining effort.
- Start Here explains the recommendation with the deadline, priority (when High or Low), and time estimate.
- Changing an assignment's time estimate marks the Daily Check-in plan as changed.
- Existing assignments without estimates remain valid and are treated neutrally until edited.

## Data compatibility
V3.5 preserves the existing localStorage keys:
- `studyos-assignments`
- `studyos-sessions`
- `studyos-checkin-date`
- `studyos-last-course`
- `studyos-last-priority`

The new `remainingMinutes` property is added to assignments. Existing assignment records are not discarded or migrated destructively.

## Install
1. Make a backup of your current project files.
2. Replace `index.html`, `style.css`, and `script.js` with the files in this folder.
3. Commit and push the changes to your GitHub Pages repository.
4. Open the deployed site and test with a few sample assignments.

## Suggested manual checks
1. Add an assignment with a due date tomorrow and a 60-minute estimate.
2. Add a High-priority assignment due four days from now with a 15-minute estimate. The assignment due tomorrow should rank first.
3. Give two assignments the same due date and priority, but different estimates. The shorter estimate should receive a modest preference.
4. Edit an assignment's estimate and confirm Daily Check-in changes to `Plan changed` if today's plan was already reviewed.
5. Confirm older assignments with no estimate still display and sort normally.
6. Mark an assignment complete and confirm it no longer appears in Start Here.
7. Confirm assignments and study sessions remain after refreshing the page.

## Important
The estimate represents the work still remaining, not the original total assignment length. Update it as progress is made. Difficulty and progress are not tracked as separate fields in this version; students can reflect both in the remaining-time estimate.

The recommendation weights are an initial, transparent experiment—not a guarantee that every recommendation will match every student's judgment. Validate with testers before making further changes.
