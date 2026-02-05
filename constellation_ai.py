"""
Sidera Constellation AI Server
FastAPI server for generating constellation images using Stable Diffusion XL with ControlNet
Optimized for NVIDIA RTX 3090
"""

import os
import cv2
import numpy as np
import torch
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
from huggingface_hub import login
from deep_translator import GoogleTranslator
import re

# Diffusers imports
from diffusers import StableDiffusionXLControlNetPipeline, ControlNetModel, AutoencoderKL
from diffusers.utils import load_image

# ============================================================================
# Environment Setup - Load HuggingFace Token from Backend/.env
# ============================================================================

SCRIPT_DIR = Path(__file__).parent.resolve()
BACKEND_ENV_PATH = SCRIPT_DIR / "Backend" / ".env"

# Load environment variables from Backend/.env
if BACKEND_ENV_PATH.exists():
    load_dotenv(BACKEND_ENV_PATH)
    print(f"[AI] Loaded environment from: {BACKEND_ENV_PATH}")
else:
    load_dotenv()  # Fallback to default .env
    print("[AI] Warning: Backend/.env not found, using default .env")

# Get HuggingFace token
HF_TOKEN = os.getenv("IMAGE_HUGGING_FACE_API") or os.getenv("HUGGING_FACE_TOKEN")
if HF_TOKEN:
    login(token=HF_TOKEN)
    print("[AI] HuggingFace authentication successful")
else:
    print("[AI] Warning: No HuggingFace token found. Some models may not be accessible.")

# ============================================================================
# Pydantic Models
# ============================================================================

class Position(BaseModel):
    x: float
    y: float
    z: float = 0.0

class Node(BaseModel):
    id: str
    position: Position

class Edge(BaseModel):
    source: str
    target: str

class ConstellationRequest(BaseModel):
    projectId: str
    constellationName: str
    nodes: List[Node]
    edges: List[Edge]
    prompt: Optional[str] = None

class ConstellationResponse(BaseModel):
    success: bool
    imageUrl: str
    message: Optional[str] = None

# ============================================================================
# FastAPI App Setup
# ============================================================================

app = FastAPI(
    title="Sidera Constellation AI",
    description="GPU-accelerated constellation image generation using SDXL + ControlNet",
    version="1.0.0"
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Global Pipeline (Lazy Loading)
# ============================================================================

pipeline = None
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

# Output directory
OUTPUT_DIR = SCRIPT_DIR / "Backend" / "public" / "constellations"


def load_pipeline():
    """
    Load the SDXL + ControlNet pipeline optimized for RTX 3090
    Uses lazy loading to avoid memory issues at startup
    """
    global pipeline
    
    if pipeline is not None:
        return pipeline
    
    print(f"[AI] Loading ControlNet model on {DEVICE}...")
    
    # Load ControlNet for lineart guidance
    controlnet = ControlNetModel.from_pretrained(
        "diffusers/controlnet-canny-sdxl-1.0",  # Using canny as lineart alternative
        torch_dtype=DTYPE,
        use_safetensors=True,
        variant="fp16" if DTYPE == torch.float16 else None,
        token=HF_TOKEN
    )
    
    print("[AI] Loading SDXL base model...")
    
    # Load VAE for better image quality
    vae = AutoencoderKL.from_pretrained(
        "madebyollin/sdxl-vae-fp16-fix",
        torch_dtype=DTYPE,
        token=HF_TOKEN
    )
    
    # Load the full SDXL + ControlNet pipeline
    pipeline = StableDiffusionXLControlNetPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        controlnet=controlnet,
        vae=vae,
        torch_dtype=DTYPE,
        use_safetensors=True,
        variant="fp16" if DTYPE == torch.float16 else None,
        token=HF_TOKEN
    )
    
    # Move to GPU
    pipeline = pipeline.to(DEVICE)
    
    # Memory optimizations for RTX 3090 (24GB VRAM)
    pipeline.enable_model_cpu_offload()  # Offload unused models to CPU
    pipeline.enable_vae_slicing()  # Reduce VRAM usage for VAE
    
    print(f"[AI] Pipeline loaded successfully on {DEVICE}")
    return pipeline


# ============================================================================
# Skeleton Generation (OpenCV)
# ============================================================================

def create_constellation_skeleton(
    nodes: List[Node],
    edges: List[Edge],
    width: int = 1024,
    height: int = 1024,
    padding: float = 0.15
) -> np.ndarray:
    """
    Create a ControlNet guide image by drawing the constellation skeleton.
    Projects 3D positions to 2D and draws white lines/points on black background.
    
    Args:
        nodes: List of nodes with 3D positions
        edges: List of edges connecting nodes
        width: Output image width
        height: Output image height
        padding: Padding ratio for the edges of the image
    
    Returns:
        numpy array: Grayscale skeleton image suitable for ControlNet
    """
    # Create black background
    skeleton = np.zeros((height, width), dtype=np.uint8)
    
    if not nodes:
        return cv2.cvtColor(skeleton, cv2.COLOR_GRAY2RGB)
    
    # Build node lookup map
    node_map = {node.id: node for node in nodes}
    
    # Extract 2D positions (project X, Y; ignore Z for simplicity)
    # Could implement proper 3D->2D projection if needed
    positions_2d = [(node.position.x, node.position.y) for node in nodes]
    xs = [p[0] for p in positions_2d]
    ys = [p[1] for p in positions_2d]
    
    # Find bounds
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    # Handle edge case where all nodes are at same position
    range_x = max_x - min_x if max_x != min_x else 1.0
    range_y = max_y - min_y if max_y != min_y else 1.0
    
    # Calculate drawable area with padding
    pad_px = int(width * padding)
    draw_width = width - 2 * pad_px
    draw_height = height - 2 * pad_px
    
    def normalize_position(x: float, y: float) -> tuple:
        """Normalize 3D position to 2D pixel coordinates"""
        # Normalize to 0-1 range
        norm_x = (x - min_x) / range_x
        norm_y = (y - min_y) / range_y
        
        # Flip Y axis (canvas Y increases downward, 3D Y increases upward)
        norm_y = 1.0 - norm_y
        
        # Scale to drawable area
        px = int(pad_px + norm_x * draw_width)
        py = int(pad_px + norm_y * draw_height)
        
        return (px, py)
    
    # Create position lookup
    pixel_positions = {}
    for node in nodes:
        pixel_positions[node.id] = normalize_position(
            node.position.x,
            node.position.y
        )
    
    # Draw edges as white lines
    for edge in edges:
        if edge.source in pixel_positions and edge.target in pixel_positions:
            pt1 = pixel_positions[edge.source]
            pt2 = pixel_positions[edge.target]
            
            # Draw anti-aliased line
            cv2.line(skeleton, pt1, pt2, 255, thickness=2, lineType=cv2.LINE_AA)
    
    # Draw nodes as glowing points
    for node_id, (px, py) in pixel_positions.items():
        # Outer glow (larger, dimmer circle)
        cv2.circle(skeleton, (px, py), 12, 80, -1, lineType=cv2.LINE_AA)
        cv2.circle(skeleton, (px, py), 8, 150, -1, lineType=cv2.LINE_AA)
        # Inner bright core
        cv2.circle(skeleton, (px, py), 4, 255, -1, lineType=cv2.LINE_AA)
    
    # Apply slight Gaussian blur for smoother ControlNet guidance
    skeleton = cv2.GaussianBlur(skeleton, (3, 3), 0)
    
    # Convert to RGB (ControlNet expects 3-channel image)
    skeleton_rgb = cv2.cvtColor(skeleton, cv2.COLOR_GRAY2RGB)
    
    return skeleton_rgb


def apply_canny_edge(image: np.ndarray, low_threshold: int = 50, high_threshold: int = 150) -> np.ndarray:
    """
    Apply Canny edge detection to the skeleton for ControlNet compatibility
    """
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY) if len(image.shape) == 3 else image
    edges = cv2.Canny(gray, low_threshold, high_threshold)
    return cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)


# ============================================================================
# API Endpoints
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Pre-warm the pipeline on server startup"""
    print("[AI] Sidera Constellation AI Server starting...")
    print(f"[AI] CUDA Available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"[AI] GPU: {torch.cuda.get_device_name(0)}")
        print(f"[AI] VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    
    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[AI] Output directory: {OUTPUT_DIR}")
    
    # Optional: Pre-load pipeline (comment out for faster startup)
    # load_pipeline()


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Sidera Constellation AI",
        "status": "running",
        "device": DEVICE,
        "cuda_available": torch.cuda.is_available()
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "device": DEVICE,
        "pipeline_loaded": pipeline is not None,
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "vram_total_gb": torch.cuda.get_device_properties(0).total_memory / 1024**3 if torch.cuda.is_available() else 0
    }


@app.post("/generate-constellation", response_model=ConstellationResponse)
async def generate_constellation(request: ConstellationRequest):
    """
    Generate a constellation image based on node positions and edges.
    
    Uses SDXL + ControlNet to create a nebula-style artwork guided by
    the constellation's shape.
    """
    try:
        print(f"[AI] Generating constellation: {request.constellationName} (Project: {request.projectId})")
        print(f"[AI] Nodes: {len(request.nodes)}, Edges: {len(request.edges)}")
        
        # Ensure output directory exists
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        
        # Generate skeleton/guide image from constellation structure
        print("[AI] Creating constellation skeleton...")
        skeleton = create_constellation_skeleton(request.nodes, request.edges)
        
        # Apply Canny edge detection for ControlNet
        control_image = apply_canny_edge(skeleton)
        
        # Save debug skeleton image (optional)
        debug_skeleton_path = OUTPUT_DIR / f"{request.projectId}_skeleton.png"
        cv2.imwrite(str(debug_skeleton_path), skeleton)
        print(f"[AI] Skeleton saved to: {debug_skeleton_path}")
        
        # Load the pipeline (lazy loading)
        pipe = load_pipeline()
        
        # Translate constellation name if it contains non-English characters (e.g., Korean)
        constellation_name_for_prompt = request.constellationName
        if re.search(r'[^\x00-\x7F]', request.constellationName):
            try:
                translated_name = GoogleTranslator(source='auto', target='en').translate(request.constellationName)
                print(f"[AI] Translated name: {request.constellationName} -> {translated_name}")
                constellation_name_for_prompt = translated_name
            except Exception as translate_err:
                print(f"[AI] Translation failed: {translate_err}, using original name")
        
        # Build the generation prompt
        base_prompt = request.prompt or "ethereal nebula constellation art"
        full_prompt = (
            f"A breathtaking cosmic nebula scene of {constellation_name_for_prompt}, "
            f"{base_prompt}, vibrant stars, ethereal glow, cosmic dust, "
            f"dark deep space background, galaxy clusters, 8k resolution, "
            f"cinematic lighting, ultra detailed, masterpiece"
        )
        
        negative_prompt = (
            "blurry, low quality, distorted, deformed, ugly, bad anatomy, "
            "watermark, text, signature, frame, border, cartoon, anime, "
            "oversaturated, overexposed, underexposed"
        )
        
        print(f"[AI] Prompt: {full_prompt[:100]}...")
        
        # Convert skeleton to PIL Image for the pipeline
        from PIL import Image
        control_pil = Image.fromarray(control_image)
        
        # Generate the image
        print("[AI] Running SDXL + ControlNet inference...")
        with torch.inference_mode():
            result = pipe(
                prompt=full_prompt,
                negative_prompt=negative_prompt,
                image=control_pil,
                num_inference_steps=30,
                guidance_scale=7.5,
                controlnet_conditioning_scale=0.5,  # Balance between prompt and structure
                generator=torch.Generator(device=DEVICE).manual_seed(42)  # Reproducible
            )
        
        generated_image = result.images[0]
        
        # Save the generated image
        output_path = OUTPUT_DIR / f"{request.projectId}.png"
        generated_image.save(str(output_path), "PNG", quality=95)
        print(f"[AI] Image saved to: {output_path}")
        
        # Return relative URL path for the backend
        relative_url = f"/constellations/{request.projectId}.png"
        
        return ConstellationResponse(
            success=True,
            imageUrl=relative_url,
            message=f"Constellation '{request.constellationName}' generated successfully"
        )
        
    except Exception as e:
        print(f"[AI] Error generating constellation: {str(e)}")
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate constellation image: {str(e)}"
        )


@app.post("/generate-constellation-simple")
async def generate_constellation_simple(request: ConstellationRequest):
    """
    Fallback endpoint that generates only the skeleton without AI.
    Useful when GPU is unavailable or for testing.
    """
    try:
        print(f"[AI] Generating simple skeleton for: {request.constellationName}")
        
        # Ensure output directory exists
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        
        # Generate skeleton
        skeleton = create_constellation_skeleton(request.nodes, request.edges)
        
        # Save as the final image (skeleton only)
        output_path = OUTPUT_DIR / f"{request.projectId}.png"
        cv2.imwrite(str(output_path), skeleton)
        
        relative_url = f"/constellations/{request.projectId}.png"
        
        return ConstellationResponse(
            success=True,
            imageUrl=relative_url,
            message="Skeleton image generated (no AI enhancement)"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate skeleton: {str(e)}"
        )


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("  Sidera Constellation AI Server")
    print("  Powered by Stable Diffusion XL + ControlNet")
    print("=" * 60)
    
    uvicorn.run(
        "constellation_ai:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Set to True for development
        workers=1  # Single worker for GPU memory management
    )
