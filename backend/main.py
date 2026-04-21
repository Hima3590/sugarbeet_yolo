from fastapi import FastAPI, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import io
import cv2
import numpy as np
import base64

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO("best.pt")

@app.post("/predict")
async def predict(file: UploadFile = File(...), show_grid: bool = Query(True)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    
    image_np = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    h, w, _ = image_np.shape

    results = model(image)
    r = results[0]

    weed_count = 0
    crop_count = 0
    crop_areas = []
    weed_centers = []
    crop_centers = []
    
    for i, box in enumerate(r.boxes):
        cls_id = int(box.cls[0])
        conf = box.conf[0]
        x1, y1, x2, y2 = box.xyxy[0]
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
        
        if cls_id == 0:  # Crop
            crop_count += 1
            color = (0, 255, 0)
            label = f"C {conf:.2f}"
            crop_areas.append((x2 - x1) * (y2 - y1))
            crop_centers.append(((x1 + x2) // 2, (y1 + y2) // 2))
        elif cls_id == 1:  # Weed
            weed_count += 1
            color = (0, 0, 255)
            label = f"W {conf:.2f}"
            weed_centers.append(((x1 + x2) // 2, (y1 + y2) // 2))
        else:
            continue
        
        cv2.rectangle(image_np, (x1, y1), (x2, y2), color, 2)

    # --- UPGRADE: VRA Sprayer Boom & Zonal Mapping ---
    grid_rows, grid_cols = 4, 4
    z_h, z_w = h // grid_rows, w // grid_cols
    hotspot_zones = 0
    nozzle_logic = [] # Status for 4 boom sections

    overlay = image_np.copy()
    
    # First pass: Calculate weed and crop counts per column
    col_weed_counts = []
    col_crop_counts = []
    zone_weed_counts = []
    
    for c_idx in range(grid_cols):
        col_zx1 = c_idx * z_w
        col_zx2 = col_zx1 + z_w
        weeds_in_col = sum(1 for wx, wy in weed_centers if col_zx1 <= wx < col_zx2)
        crops_in_col = sum(1 for cx, cy in crop_centers if col_zx1 <= cx < col_zx2)
        col_weed_counts.append(weeds_in_col)
        col_crop_counts.append(crops_in_col)
    
    # Count weeds in each zone for heatmap
    for c_idx in range(grid_cols):
        col_zx1 = c_idx * z_w
        col_zx2 = col_zx1 + z_w
        for r_idx in range(grid_rows):
            zy1 = r_idx * z_h
            zy2 = zy1 + z_h
            weeds_in_zone = sum(1 for wx, wy in weed_centers if col_zx1 <= wx < col_zx2 and zy1 <= wy < zy2)
            zone_weed_counts.append(weeds_in_zone)
    
    # Dynamic Threshold Calculation (Percentile-based for 4 columns)
    sorted_counts = sorted(col_weed_counts)
    
    # For 4 columns: HIGH = 75th percentile, LOW = min value
    if len(sorted_counts) == 4:
        low_threshold = max(0, sorted_counts[0])
        high_threshold = max(low_threshold + 1, sorted_counts[2])
    else:
        low_threshold = 1
        high_threshold = 5
    
    # Hotspot threshold: zones with HIGH weed density (top 25% of all zones)
    sorted_zone_counts = sorted(zone_weed_counts, reverse=True)
    if len(sorted_zone_counts) > 0:
        # Use 75th percentile from top (densest zones)
        hotspot_idx = max(0, len(sorted_zone_counts) // 4)  # Top 25%
        hotspot_threshold = max(2, sorted_zone_counts[hotspot_idx])
    else:
        hotspot_threshold = 1
    
    # Second pass: Apply nozzle logic with dynamic thresholds
    for c_idx in range(grid_cols):
        col_zx1 = c_idx * z_w
        col_zx2 = col_zx1 + z_w
        weeds_in_col = col_weed_counts[c_idx]
        crops_in_col = col_crop_counts[c_idx]
        
        # Decision Logic for Nozzle (Adaptive)
        # Priority: If weeds > crops, ALWAYS use HIGH (field losing control)
        if weeds_in_col > crops_in_col:
            nozzle_logic.append("HIGH")
        elif weeds_in_col >= high_threshold:
            nozzle_logic.append("HIGH")
        elif weeds_in_col >= low_threshold:
            nozzle_logic.append("LOW")
        else:
            nozzle_logic.append("OFF")

        # Zonal Heatmap Logic (Rows and Cols)
        for r_idx in range(grid_rows):
            zy1 = r_idx * z_h
            zy2 = zy1 + z_h
            weeds_in_zone = sum(1 for wx, wy in weed_centers if col_zx1 <= wx < col_zx2 and zy1 <= wy < zy2)
            
            if weeds_in_zone >= hotspot_threshold:
                hotspot_zones += 1
                cv2.rectangle(overlay, (col_zx1, zy1), (col_zx2, zy2), (0, 0, 255), -1)
    
    # Apply grid overlay and draw grid lines
    if show_grid:
        # Draw vertical grid lines
        for c_idx in range(1, grid_cols):
            x = c_idx * z_w
            cv2.line(overlay, (x, 0), (x, h), (0, 255, 255), 8)
        
        # Draw horizontal grid lines
        for r_idx in range(1, grid_rows):
            y = r_idx * z_h
            cv2.line(overlay, (0, y), (w, y), (0, 255, 255), 8)
        
        cv2.addWeighted(overlay, 0.3, image_np, 0.7, 0, image_np)

    # --- Analytics ---
    avg_area = sum(crop_areas) / len(crop_areas) if crop_areas else 0
    percent_occupied = (avg_area / (h * w)) * 100
    if avg_area == 0: stage = "N/A"
    elif percent_occupied < 2.0: stage = "Seedling"
    elif percent_occupied < 8.0: stage = "Vegetative"
    else: stage = "Mature"

    infestation_rate = (weed_count / (crop_count + weed_count)) if (crop_count + weed_count) > 0 else 0
    herbicide_saved = round((1 - infestation_rate) * 100, 2)

    # Encoding
    image_rgb = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
    image_pil = Image.fromarray(image_rgb)
    img_bytes = io.BytesIO()
    image_pil.save(img_bytes, format='PNG')
    img_base64 = base64.b64encode(img_bytes.getvalue()).decode()

    return {
        "weed_count": weed_count,
        "crop_count": crop_count,
        "growth_stage": stage,
        "herbicide_savings": f"{herbicide_saved}%",
        "infestation_level": "High" if infestation_rate > 0.3 else "Moderate" if infestation_rate > 0.1 else "Low",
        "hotspot_zones": hotspot_zones,
        "nozzle_logic": nozzle_logic,  # <--- MAKE SURE THIS IS HERE
        "result_image": f"data:image/png;base64,{img_base64}"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
