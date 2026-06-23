# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for SignSee NGT Desktop App
PyTorch + EfficientNet + MediaPipe + Dutch Dictionary
"""

from PyInstaller.utils.hooks import collect_data_files, collect_submodules, collect_dynamic_libs

block_cipher = None

datas = [
    # Model files
    ('models/best_ngt_model_v2.pth', 'models'),
    ('models/best_landmark_mlp.pth', 'models'),

    # MediaPipe model
    ('hand_landmarker.task', '.'),

    # Dutch dictionary
    ('dutch_words.txt', '.'),

    # Frontend build
    ('sign-see-ngt-main/dist', 'sign-see-ngt-main/dist'),
]

hiddenimports = [
    # FastAPI
    'fastapi', 'fastapi.middleware', 'fastapi.middleware.cors',
    'fastapi.staticfiles', 'fastapi.responses',

    # Uvicorn — all internal modules needed at runtime
    'uvicorn', 'uvicorn.main', 'uvicorn.config', 'uvicorn.logging',
    'uvicorn.loops', 'uvicorn.loops.auto', 'uvicorn.loops.asyncio',
    'uvicorn.protocols', 'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto', 'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.http.httptools_impl',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.protocols.websockets.websockets_impl',
    'uvicorn.protocols.websockets.wsproto_impl',
    'uvicorn.lifespan', 'uvicorn.lifespan.on', 'uvicorn.lifespan.off',

    # Starlette
    'starlette', 'starlette.applications', 'starlette.middleware',
    'starlette.routing', 'starlette.requests', 'starlette.responses',
    'starlette.websockets', 'starlette.staticfiles',
    'starlette.formparsers', 'starlette.concurrency',

    # Pydantic
    'pydantic', 'pydantic_core', 'pydantic.deprecated',

    # PyTorch
    'torch', 'torch.nn', 'torch.nn.functional',
    'torchvision', 'torchvision.models', 'torchvision.transforms',
    'torchvision.models.efficientnet',

    # ML libraries
    'numpy', 'PIL', 'PIL._imaging', 'cv2',
    'mediapipe', 'mediapipe.tasks', 'mediapipe.tasks.python',
    'mediapipe.tasks.python.vision',

    # PyWebView
    'webview',

    # HTTP / WebSocket
    'websockets', 'websockets.legacy', 'websockets.legacy.server',
    'h11', 'httptools', 'anyio', 'anyio._backends', 'anyio._backends._asyncio',
    'python_multipart',

    # Misc
    'bisect', 'collections', 'itertools',
]

# Collect data files for ML libraries
datas += collect_data_files('mediapipe', include_py_files=False)
datas += collect_data_files('torch', include_py_files=False)
datas += collect_data_files('torchvision', include_py_files=False)

# Collect dynamic libs (torch ships .dll/.so files)
binaries = collect_dynamic_libs('torch')
binaries += collect_dynamic_libs('torchvision')

# Collect submodules
hiddenimports += collect_submodules('mediapipe')
hiddenimports += collect_submodules('uvicorn')
hiddenimports += collect_submodules('starlette')

a = Analysis(
    ['app_desktop.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tensorflow', 'keras', 'tensorboard', 'matplotlib', 'scipy'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='SignSeeNGT',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Show console for debugging — set False for final release
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='SignSeeNGT',
)
