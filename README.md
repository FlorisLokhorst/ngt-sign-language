# NGT Sign Language Recognition

Real-time Dutch Sign Language (NGT) recognition from a webcam. Classifies signs as they happen, builds sentences with Dutch dictionary suggestions, and packages as a standalone exe so it runs on any machine without a Python environment.

## How it works

Two models run in combination. EfficientNet-B0 is the primary classifier. When its confidence drops below 70%, a MediaPipe landmark-based MLP takes over — useful for signs where hand shape matters more than visual appearance. A 15-frame prediction smoother prevents flickering on ambiguous frames.

On top of classification there's a sentence builder that matches predicted signs against a Dutch dictionary to surface word completions. There's also a speedrun mode for practising sign sequences quickly.

The backend is a FastAPI server streaming predictions over WebSockets. The frontend is a React app. Both are bundled into a single standalone executable via PyInstaller.

## Stack

- **Classification**: PyTorch, EfficientNet-B0, landmark MLP
- **Hand tracking**: MediaPipe
- **Backend**: FastAPI, WebSockets
- **Frontend**: React
- **Packaging**: PyInstaller

## Running from source

Requires Python 3.10+.

```bash
pip install -r requirements.txt
uvicorn app:app --reload
```

Frontend (separate terminal):

```bash
cd sign-see-ngt-main
npm install
npm run dev
```

Or run the packaged exe directly — no setup needed.

## Notes

- Trained on NGT (Nederlandse Gebarentaal), not ASL
- Landmark fallback triggers automatically when EfficientNet confidence < 0.70
- 15-frame majority window smooths predictions to reduce flickering
