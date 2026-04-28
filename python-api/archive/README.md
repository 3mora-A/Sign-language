# Archived Utilities

This folder contains training, evaluation, and preprocessing scripts that are not needed for the daily runtime flow.

The active runtime path is:

- `python-api/main.py`
- `python-api/emotion/`
- `python-api/gesture/`
- `python-api/scripts/emotion/predict_emotion.py`

The files in this archive are kept for:

- retraining the emotion model
- retraining the gesture model later
- rebuilding intermediate datasets when needed

Archived raw datasets can live outside the repository. By default, the archive
scripts will look for external data under `../signlang_external_data/` relative
to the repo root, or they can be pointed explicitly with:

- `SIGNLANG_EXTERNAL_DATA_ROOT`
- `SIGNLANG_DATASET_DIR`
- `SIGNLANG_BG_REMOVED_DIR`
- `SIGNLANG_FRAMES_DATASET_DIR`
