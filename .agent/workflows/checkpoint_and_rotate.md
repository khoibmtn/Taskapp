---
description: Workflow to save current work, merge to main, checkpoint, and rotate to a new timestamped branch.
---

1.  **Commit Changes**: Ensure all current changes are committed.
    ```bash
    git add .
    git commit -m "feat: <description>"
    ```

2.  **Merge to Main**: Switch to main and merge the current feature branch.
    ```bash
    git checkout main
    git merge <current_branch>
    ```

3.  **Create Checkpoint Tag**: Create a new tag (incrementing the version/checkpoint number).
    ```bash
    git tag checkpoint-<N>
    ```

4.  **Rotate to New Branch**: Create and switch to a new branch with the current timestamp format `temp_DD.MM.HH.mm`.
    ```bash
    # Example format: temp_19.12.10.07
    git checkout -b temp_$(date +"%d.%m.%H.%M")
    ```

5.  **Clean Up (Optional)**: Delete the old temporary branch if no longer needed.
