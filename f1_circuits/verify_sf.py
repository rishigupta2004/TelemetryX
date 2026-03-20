import json
import glob
import os

json_path = "../frontend/src/data/start_finish_points.json"
with open(json_path, 'r') as f:
    json_data = json.load(f)

json_map = {item['circuitFolder']: (item['lon'], item['lat']) for item in json_data}

geojson_files = glob.glob("*/layers/start_finish*.geojson")

mismatches = []
missing_in_json = []

for path in geojson_files:
    folder = path.split(os.sep)[0]
    # Handle melbourne override
    check_folder = "albert_park" if folder == "melbourne" else folder
    
    with open(path, 'r') as f:
        try:
            g_data = json.load(f)
        except Exception:
            continue
            
    features = g_data.get("features", [])
    if not features: continue
    
    geom = features[0].get("geometry")
    if not geom: continue
    
    coords = geom.get("coordinates", [])
    if len(coords) < 2:
        continue
        
    gj_lon, gj_lat = coords[0], coords[1]
    
    if check_folder in json_map:
        j_lon, j_lat = json_map[check_folder]
        # Compare with tolerance
        if abs(gj_lon - j_lon) > 0.0001 or abs(gj_lat - j_lat) > 0.0001:
            mismatches.append(f"{check_folder}: GEOJSON({gj_lon:.5f}, {gj_lat:.5f}) != JSON({j_lon:.5f}, {j_lat:.5f})")
        else:
            pass
            # print(f"Match for {check_folder}")
    else:
        missing_in_json.append(f"{check_folder}: {gj_lon}, {gj_lat}")

print("\n--- Mismatches ---")
for m in mismatches:
    print(m)

print("\n--- Missing in JSON ---")
for m in missing_in_json:
    print(m)
