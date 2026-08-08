import json
import random

def generate_random_level(level_id, plane_count):
    colors = ["#00ffcc", "#00bfff", "#ffaa00", "#ff0055"]
    level = {
        "level": level_id,
        "name": f"Generated Sector Level {level_id}",
        "targetWaypoint": {"name": "MOD", "x": 750, "y": 260},
        "aircraft": []
    }
    
    for i in range(plane_count):
        plane = {
            "id": f"FLIGHT-{random.randint(100, 999)}",
            "x": 30,
            "y": 80 + (i * 120),
            "speed": random.choice([320, 360, 400, 440, 480, 520]),
            "color": colors[i % len(colors)]
        }
        level["aircraft"].append(plane)
        
    return level

if __name__ == "__main__":
    # Create a 3-level campaign file automatically
    campaign = [generate_random_level(i, i + 1) for i in range(1, 4)]
    
    with open("levels.json", "w") as f:
        json.dump(campaign, f, indent=2)
        
    print(" successfully generated levels.json!")
