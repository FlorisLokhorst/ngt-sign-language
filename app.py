"""
FastAPI Backend for Real-Time NGT Sign Language Recognition
PyTorch + EfficientNet-B0 + MediaPipe hand detection + Landmark MLP fallback
Features: Prediction smoothing, Sentence building, Dutch dictionary suggestions,
          Abbreviation recognition (English + Dutch)
"""
import sys
import json
import base64
import io
import time
import math
import bisect
import numpy as np
from PIL import Image
from collections import deque, Counter
from itertools import combinations
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import torch
import torch.nn as nn
from torchvision import models, transforms
import cv2
import mediapipe as mp
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration — supports both normal run and bundled exe
# ---------------------------------------------------------------------------
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).parent
IMG_SIZE = 224
MODEL_PATH = BASE_DIR / "models" / "best_ngt_model_v2.pth"
LM_MODEL_PATH = BASE_DIR / "models" / "best_landmark_mlp.pth"
HAND_LANDMARKER_PATH = BASE_DIR / "hand_landmarker.task"
DICT_PATH = BASE_DIR / "dutch_words.txt"
FRONTEND_BUILD_DIR = BASE_DIR / "sign-see-ngt-main" / "dist"
RECORDINGS_DIR = "recorded_data"

Path(RECORDINGS_DIR).mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="NGT Sign Language Recognition API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Globals
# ---------------------------------------------------------------------------
model = None           # EfficientNet-B0 image model
landmark_model = None  # Landmark MLP
class_names = None     # from EfficientNet checkpoint
lm_class_names = None  # from landmark checkpoint
device = None
hands_detector = None


# ---------------------------------------------------------------------------
# Prediction smoother — stabilises jittery frame-by-frame predictions
# ---------------------------------------------------------------------------
class PredictionSmoother:
    WINDOW_SIZE = 15
    THRESHOLD = 10        # out of 15 frames must agree
    MIN_CONFIDENCE = 0.60

    def __init__(self):
        self.buffer = deque(maxlen=self.WINDOW_SIZE)
        self.stable_letter = None
        self.stable_confidence = 0.0

    def update(self, letter: str, confidence: float):
        self.buffer.append((letter, confidence))
        if len(self.buffer) < self.WINDOW_SIZE:
            return
        votes = Counter(l for l, _ in self.buffer)
        top_letter, top_count = votes.most_common(1)[0]
        if top_count >= self.THRESHOLD:
            avg_conf = sum(c for l, c in self.buffer if l == top_letter) / top_count
            if avg_conf >= self.MIN_CONFIDENCE:
                self.stable_letter = top_letter
                self.stable_confidence = avg_conf
            else:
                self.stable_letter = None
                self.stable_confidence = 0.0
        else:
            self.stable_letter = None
            self.stable_confidence = 0.0

    def clear(self):
        self.buffer.clear()
        self.stable_letter = None
        self.stable_confidence = 0.0


smoother = PredictionSmoother()


# ---------------------------------------------------------------------------
# Abbreviations — English (commonly used in Dutch too) + Dutch
# ---------------------------------------------------------------------------
ABBREVIATIONS = {
    # English — widely used in Dutch digital communication
    "BRB": "Be Right Back",
    "OMG": "Oh My God",
    "LOL": "Laugh Out Loud",
    "IDK": "I Don't Know",
    "IKR": "I Know Right",
    "BTW": "By The Way",
    "NGL": "Not Gonna Lie",
    "IMO": "In My Opinion",
    "ASAP": "As Soon As Possible",
    "FYI": "For Your Information",
    "TBH": "To Be Honest",
    "SMH": "Shaking My Head",
    "AFK": "Away From Keyboard",
    "GG": "Good Game",
    "WYD": "What You Doing",
    "HMU": "Hit Me Up",
    "NVM": "Never Mind",
    "IRL": "In Real Life",
    "OFC": "Of Course",
    "TMI": "Too Much Information",
    # Dutch abbreviations
    "AUB": "Alstublieft",
    "SVP": "S'il Vous Plait (Alstublieft)",
    "MVG": "Met Vriendelijke Groet",
    "GR": "Groetjes",
    "IIG": "In Ieder Geval",
    "IDD": "Inderdaad",
    "WRS": "Waarschijnlijk",
    "EVT": "Eventueel",
    "BVB": "Bijvoorbeeld",
    "AHW": "Als Het Ware",
    "NVT": "Niet Van Toepassing",
    "WSS": "Waarschijnlijk",
    "HDV": "Hou Van Je",
    "KZN": "Kan Zijn",
    "MGH": "Maakt Geen Hout",
    "HB": "Heb",
    "WTN": "Weten",
    "GVD": "Godverdomme",
}


# ---------------------------------------------------------------------------
# Dutch dictionary — loaded from dutch_words.txt, used for prefix suggestions
# ---------------------------------------------------------------------------
class DutchDictionary:
    def __init__(self):
        self.words = []
        self.loaded = False

    def load(self, filepath: str):
        path = Path(filepath)
        if not path.exists():
            print(f"[WARN] Dutch dictionary not found at {filepath}")
            return
        with open(path, "r", encoding="utf-8") as f:
            self.words = [line.strip().upper() for line in f if line.strip()]
        self.words.sort()
        self.loaded = True
        print(f"[OK] Dutch dictionary loaded: {len(self.words)} words")

    def suggest(self, prefix: str, max_results: int = 5) -> list[str]:
        if not self.loaded or not prefix:
            return []
        prefix = prefix.upper()
        idx = bisect.bisect_left(self.words, prefix)
        suggestions = []
        while idx < len(self.words) and len(suggestions) < max_results:
            if self.words[idx].startswith(prefix):
                suggestions.append(self.words[idx])
            else:
                break
            idx += 1
        return suggestions


dutch_dict = DutchDictionary()


# ---------------------------------------------------------------------------
# Sequence builder — converts stable predictions into words and sentences
# ---------------------------------------------------------------------------
class SequenceBuilder:
    LETTER_HOLD_SEC = 1.0
    COOLDOWN_SEC = 1.0
    SPACE_PAUSE_SEC = 1.5

    def __init__(self):
        self.reset()

    def reset(self):
        self.sentence = ""
        self.current_word = ""
        self.last_letter = None
        self.letter_since = None
        self.last_committed = None
        self.committed_letter = None
        self.no_hand_since = None
        self.last_expansion = None

    def update(self, stable_letter, hand_detected) -> dict:
        now = time.time()
        committed_letter = None
        abbreviation = None

        if not hand_detected:
            if self.no_hand_since is None:
                self.no_hand_since = now
            elif now - self.no_hand_since >= self.SPACE_PAUSE_SEC:
                if self.current_word:
                    self.sentence += self.current_word + " "
                    self.current_word = ""
                    self.no_hand_since = now
            self.last_letter = None
            self.letter_since = None
            self.committed_letter = None
        else:
            self.no_hand_since = None

            if stable_letter is None:
                self.last_letter = None
                self.letter_since = None
                self.committed_letter = None
            elif stable_letter == self.committed_letter:
                self.last_letter = None
                self.letter_since = None
            else:
                self.committed_letter = None
                if stable_letter != self.last_letter:
                    self.last_letter = stable_letter
                    self.letter_since = now
                else:
                    held = now - self.letter_since
                    cooldown_ok = (
                        self.last_committed is None
                        or now - self.last_committed >= self.COOLDOWN_SEC
                    )
                    if held >= self.LETTER_HOLD_SEC and cooldown_ok:
                        self.current_word += stable_letter
                        self.last_committed = now
                        self.committed_letter = stable_letter
                        self.last_letter = None
                        self.letter_since = None
                        committed_letter = stable_letter

                        word_upper = self.current_word.upper()
                        if word_upper in ABBREVIATIONS:
                            abbreviation = ABBREVIATIONS[word_upper]
                            self.last_expansion = abbreviation

        suggestions = dutch_dict.suggest(self.current_word, max_results=5)

        return {
            "current_word": self.current_word,
            "sentence": self.sentence.strip(),
            "committed_letter": committed_letter,
            "abbreviation": abbreviation,
            "suggestions": suggestions,
        }

    def accept_suggestion(self, word: str):
        self.sentence += word + " "
        self.current_word = ""
        self.committed_letter = None
        self.last_letter = None
        self.letter_since = None

    def clear(self):
        self.reset()


sequence_builder = SequenceBuilder()


# ---------------------------------------------------------------------------
# ImageNet normalisation — matches EfficientNet-B0 training
# ---------------------------------------------------------------------------
IMAGENET_TRANSFORM = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])


# ---------------------------------------------------------------------------
# Landmark feature engineering (must match train_landmark_mlp.py exactly)
# ---------------------------------------------------------------------------
JOINT_TRIPLETS = [
    (0, 1, 2), (1, 2, 3), (2, 3, 4),
    (0, 5, 6), (5, 6, 7), (6, 7, 8),
    (0, 9, 10), (9, 10, 11), (10, 11, 12),
    (0, 13, 14), (13, 14, 15), (14, 15, 16),
    (0, 17, 18), (17, 18, 19), (18, 19, 20),
    (5, 9, 13), (9, 13, 17),
    (0, 5, 17), (5, 9, 17), (9, 13, 17),
    (4, 8, 12),
]
FINGERTIP_PAIRS = list(combinations([4, 8, 12, 16, 20], 2))


def normalize_landmarks(lms):
    pts = np.array([[l["x"], l["y"], l["z"]] for l in lms], dtype=np.float32)
    pts -= pts[0].copy()
    scale = np.linalg.norm(pts[9])
    if scale > 1e-6:
        pts /= scale
    return pts


def angle_between(v1, v2):
    n1, n2 = np.linalg.norm(v1), np.linalg.norm(v2)
    if n1 < 1e-6 or n2 < 1e-6:
        return 0.0
    return math.acos(float(np.clip(np.dot(v1, v2) / (n1 * n2), -1.0, 1.0)))


def extract_landmark_features(lms):
    pts = normalize_landmarks(lms)
    raw = pts.flatten()
    angles = [angle_between(pts[a] - pts[b], pts[c] - pts[b]) for a, b, c in JOINT_TRIPLETS]
    dists = [float(np.linalg.norm(pts[i] - pts[j])) for i, j in FINGERTIP_PAIRS]
    return torch.tensor(np.concatenate([raw, angles, dists], dtype=np.float32)).unsqueeze(0)


def build_landmark_mlp(input_dim, num_classes):
    return nn.Sequential(
        nn.Linear(input_dim, 256), nn.BatchNorm1d(256), nn.ReLU(), nn.Dropout(0.3),
        nn.Linear(256, 128), nn.BatchNorm1d(128), nn.ReLU(), nn.Dropout(0.2),
        nn.Linear(128, 64), nn.ReLU(),
        nn.Linear(64, num_classes),
    )


def build_efficientnet(num_classes: int) -> nn.Module:
    net = models.efficientnet_b0(weights=None)
    in_features = net.classifier[1].in_features
    net.classifier = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, num_classes),
    )
    return net


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def load_model():
    global model, class_names, device, hands_detector, landmark_model, lm_class_names

    if torch.cuda.is_available():
        device = torch.device("cuda")
    elif torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")
    print(f"Using device: {device}")

    # Load EfficientNet checkpoint
    print(f"Loading NGT model from {MODEL_PATH} ...")
    ckpt = torch.load(MODEL_PATH, map_location=device, weights_only=False)
    class_names = ckpt["class_names"]
    num_classes = len(class_names)

    model = build_efficientnet(num_classes)
    model.load_state_dict(ckpt["model_state"])
    model.to(device)
    model.eval()

    print(f"[OK] Model loaded — {num_classes} classes: {class_names}")
    print(f"[OK] Checkpoint val_acc={ckpt['val_acc']:.4f}, epoch={ckpt['epoch']}")

    # Load landmark MLP
    print(f"Loading landmark MLP from {LM_MODEL_PATH} ...")
    lm_ckpt = torch.load(LM_MODEL_PATH, map_location=device, weights_only=False)
    lm_class_names = lm_ckpt["class_names"]
    lm_input_dim = lm_ckpt["input_dim"]
    landmark_model = build_landmark_mlp(lm_input_dim, len(lm_class_names))
    landmark_model.load_state_dict(lm_ckpt["model_state"])
    landmark_model.to(device)
    landmark_model.eval()
    print(f"[OK] Landmark MLP loaded — {len(lm_class_names)} classes, val_acc={lm_ckpt['val_acc']:.4f}")

    # MediaPipe hand detector
    try:
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision

        base_options = mp_python.BaseOptions(model_asset_path=str(HAND_LANDMARKER_PATH))
        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            num_hands=1,
            min_hand_detection_confidence=0.7,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        hands_detector = vision.HandLandmarker.create_from_options(options)
        print("[OK] MediaPipe Hands initialised")
    except Exception as e:
        print(f"[WARN] MediaPipe unavailable: {e} — continuing without hand detection")
        hands_detector = None

    # Dutch dictionary
    dutch_dict.load(str(DICT_PATH))


# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------
def preprocess_image(image_data: str):
    if "," in image_data:
        image_data = image_data.split(",")[1]

    img_bytes = base64.b64decode(image_data)
    pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    frame = np.array(pil_img)

    crop_pil = None
    landmarks_data = None

    if hands_detector is not None:
        try:
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame)
            result = hands_detector.detect(mp_image)

            if result.hand_landmarks:
                lms = result.hand_landmarks[0]
                h, w = frame.shape[:2]
                xs = [lm.x * w for lm in lms]
                ys = [lm.y * h for lm in lms]
                x1 = int(max(0, min(xs) - 30))
                x2 = int(min(w, max(xs) + 30))
                y1 = int(max(0, min(ys) - 30))
                y2 = int(min(h, max(ys) + 30))

                crop = frame[y1:y2, x1:x2]
                if crop.size > 0:
                    crop_pil = Image.fromarray(crop)

                landmarks_data = [
                    {"x": lm.x, "y": lm.y, "z": lm.z} for lm in lms
                ]
        except Exception as e:
            print(f"MediaPipe error: {e}")

    hand_detected = crop_pil is not None
    source = crop_pil if hand_detected else pil_img

    tensor = IMAGENET_TRANSFORM(source).unsqueeze(0).to(device)
    return hand_detected, tensor, landmarks_data


# ---------------------------------------------------------------------------
# Inference — EfficientNet primary, landmark MLP as fallback
# ---------------------------------------------------------------------------
@torch.no_grad()
def run_inference(tensor: torch.Tensor, landmarks_data=None):
    img_probs = torch.softmax(model(tensor), dim=1)[0]
    top3_vals, top3_idxs = torch.topk(img_probs, k=min(3, len(class_names)))
    predicted_letter = class_names[top3_idxs[0].item()]
    confidence = top3_vals[0].item()

    # Consult landmark model when EfficientNet is uncertain (<70%)
    if landmark_model is not None and landmarks_data is not None and confidence < 0.70:
        try:
            lm_tensor = extract_landmark_features(landmarks_data).to(device)
            lm_probs = torch.softmax(landmark_model(lm_tensor), dim=1)[0]
            lm_top1 = lm_class_names[lm_probs.argmax().item()]
            lm_conf = lm_probs.max().item()

            if lm_conf > 0.90:
                predicted_letter = lm_top1
                confidence = lm_conf
                lm_top3_vals, lm_top3_idxs = torch.topk(lm_probs, k=3)
                top_3 = [
                    {"letter": lm_class_names[i.item()], "confidence": v.item()}
                    for i, v in zip(lm_top3_idxs, lm_top3_vals)
                ]
                return predicted_letter, confidence, top_3
        except Exception as e:
            print(f"Landmark inference error: {e}")

    top_3 = [
        {"letter": class_names[i.item()], "confidence": v.item()}
        for i, v in zip(top3_idxs, top3_vals)
    ]
    return predicted_letter, confidence, top_3


# ---------------------------------------------------------------------------
# Health endpoints
# ---------------------------------------------------------------------------
@app.get("/api/status")
async def root():
    return {
        "status": "running",
        "message": "NGT Sign Language Recognition API — PyTorch + EfficientNet",
        "model_loaded": model is not None,
        "mediapipe_loaded": hands_detector is not None,
        "classes": class_names,
        "device": str(device),
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy" if model is not None else "unhealthy",
        "model_loaded": model is not None,
        "mediapipe_loaded": hands_detector is not None,
        "num_classes": len(class_names) if class_names else 0,
        "device": str(device),
    }


# ---------------------------------------------------------------------------
# WebSocket — real-time prediction with smoothing, sentences, suggestions
# ---------------------------------------------------------------------------
@app.websocket("/ws/predict")
async def websocket_predict(websocket: WebSocket):
    await websocket.accept()
    print("Client connected")

    try:
        while True:
            data = await websocket.receive_json()

            if "image" not in data:
                await websocket.send_json({"error": "No image data provided"})
                continue

            try:
                hand_detected, tensor, landmarks = preprocess_image(data["image"])

                if not hand_detected:
                    seq = sequence_builder.update(None, False)
                    await websocket.send_json({
                        "prediction": None,
                        "confidence": 0.0,
                        "top_3": [],
                        "hand_detected": False,
                        "landmarks": None,
                        "stable_prediction": smoother.stable_letter,
                        "stable_confidence": smoother.stable_confidence,
                        "current_word": seq["current_word"],
                        "sentence": seq["sentence"],
                        "committed_letter": seq["committed_letter"],
                        "abbreviation": seq["abbreviation"],
                        "suggestions": seq["suggestions"],
                    })
                    continue

                predicted_letter, confidence, top_3 = run_inference(tensor, landmarks)
                smoother.update(predicted_letter, confidence)
                seq = sequence_builder.update(smoother.stable_letter, hand_detected)

                await websocket.send_json({
                    "prediction": predicted_letter,
                    "confidence": confidence,
                    "top_3": top_3,
                    "hand_detected": hand_detected,
                    "landmarks": landmarks,
                    "stable_prediction": smoother.stable_letter,
                    "stable_confidence": smoother.stable_confidence,
                    "current_word": seq["current_word"],
                    "sentence": seq["sentence"],
                    "committed_letter": seq["committed_letter"],
                    "abbreviation": seq["abbreviation"],
                    "suggestions": seq["suggestions"],
                })

            except Exception as e:
                await websocket.send_json({"error": f"Prediction error: {str(e)}"})

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")


# ---------------------------------------------------------------------------
# Sequence / dictionary endpoints
# ---------------------------------------------------------------------------
@app.post("/api/sequence/clear")
async def clear_sequence():
    sequence_builder.clear()
    smoother.clear()
    return {"success": True}


@app.post("/api/sequence/accept")
async def accept_suggestion(data: dict):
    word = data.get("word", "")
    if not word:
        raise HTTPException(status_code=400, detail="No word provided")
    sequence_builder.accept_suggestion(word.upper())
    return {
        "success": True,
        "sentence": sequence_builder.sentence.strip(),
        "current_word": sequence_builder.current_word,
    }


@app.get("/api/dictionary/suggest")
async def dictionary_suggest(prefix: str = "", limit: int = 5):
    suggestions = dutch_dict.suggest(prefix, max_results=limit)
    return {"prefix": prefix, "suggestions": suggestions}


# ---------------------------------------------------------------------------
# Recording endpoint
# ---------------------------------------------------------------------------
@app.post("/api/record")
async def record_sample(data: dict):
    if "image" not in data or "letter" not in data:
        raise HTTPException(status_code=400, detail="Missing required fields")

    letter = data["letter"]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    letter_dir = Path(RECORDINGS_DIR) / letter
    letter_dir.mkdir(parents=True, exist_ok=True)

    img_data = data["image"]
    if "," in img_data:
        img_data = img_data.split(",")[1]

    img = Image.open(io.BytesIO(base64.b64decode(img_data)))
    img = img.transpose(Image.FLIP_LEFT_RIGHT)
    img_path = letter_dir / f"{timestamp}.jpg"
    img.save(img_path, "JPEG", quality=95)

    meta = {
        "letter": letter,
        "timestamp": timestamp,
        "confidence": data.get("confidence", 0.0),
        "landmarks": data.get("landmarks"),
        "hand_detected": data.get("hand_detected", False),
        "metadata": data.get("metadata", {}),
    }
    with open(letter_dir / f"{timestamp}.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"[OK] Recorded sample for '{letter}': {img_path}")
    return {"success": True, "message": f"Sample recorded for letter {letter}"}


@app.get("/api/recording-stats")
async def get_recording_stats():
    stats, total = {}, 0
    rp = Path(RECORDINGS_DIR)
    if rp.exists():
        for d in rp.iterdir():
            if d.is_dir():
                cnt = len(list(d.glob("*.jpg")))
                stats[d.name] = cnt
                total += cnt
    return {"total_samples": total, "samples_per_letter": stats, "letters_recorded": len(stats)}


# ---------------------------------------------------------------------------
# Speedrun endpoints
# ---------------------------------------------------------------------------
speedrun_sessions = {}


@app.post("/api/speedrun/start")
async def start_speedrun(data: dict):
    sid = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    speedrun_sessions[sid] = {
        "start_time": datetime.now().isoformat(),
        "completed_letters": [],
        "target_letters": data.get("target_letters", sorted(class_names)),
        "mode": data.get("mode", "alphabet"),
    }
    return {
        "session_id": sid,
        "target_letters": speedrun_sessions[sid]["target_letters"],
        "total_letters": len(speedrun_sessions[sid]["target_letters"]),
    }


@app.post("/api/speedrun/{session_id}/complete")
async def complete_letter(session_id: str, data: dict):
    if session_id not in speedrun_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    letter = data.get("letter")
    if not letter:
        raise HTTPException(status_code=400, detail="Letter required")

    s = speedrun_sessions[session_id]
    if letter not in s["completed_letters"]:
        s["completed_letters"].append(letter)

    is_finished = set(s["completed_letters"]) == set(s["target_letters"])
    if is_finished and "end_time" not in s:
        s["end_time"] = datetime.now().isoformat()
        start = datetime.fromisoformat(s["start_time"])
        end = datetime.fromisoformat(s["end_time"])
        s["duration_seconds"] = (end - start).total_seconds()

    return {
        "completed": len(s["completed_letters"]),
        "total": len(s["target_letters"]),
        "remaining": [l for l in s["target_letters"] if l not in s["completed_letters"]],
        "is_finished": is_finished,
        "duration": s.get("duration_seconds"),
    }


@app.get("/api/speedrun/{session_id}")
async def get_speedrun_status(session_id: str):
    if session_id not in speedrun_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    s = speedrun_sessions[session_id]
    return {
        "session_id": session_id,
        "completed_letters": s["completed_letters"],
        "target_letters": s["target_letters"],
        "progress": f"{len(s['completed_letters'])}/{len(s['target_letters'])}",
        "duration": s.get("duration_seconds"),
        "is_finished": set(s["completed_letters"]) == set(s["target_letters"]),
    }


# ---------------------------------------------------------------------------
# Serve built frontend (for production / exe — ignored during dev if no dist/)
# ---------------------------------------------------------------------------
if FRONTEND_BUILD_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_BUILD_DIR / "assets")), name="assets")
    signs_dir = FRONTEND_BUILD_DIR / "signs"
    if signs_dir.exists():
        app.mount("/signs", StaticFiles(directory=str(signs_dir)), name="signs")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            raise HTTPException(status_code=404, detail="Not found")
        index_path = FRONTEND_BUILD_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Frontend not found")


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
