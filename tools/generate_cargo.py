import json

geometries = []

def add(t, pos, size, mat, **kwargs):
    obj = {"type": t, "pos": pos, "size": size, "material": mat}
    obj.update(kwargs)
    geometries.append(obj)

# Outer bounds
add("wall", [0, 0, -59], [120, 20, 2], "wall")
add("wall", [0, 0, 59], [120, 20, 2], "wall")
add("wall", [-59, 0, 0], [2, 20, 120], "wall")
add("wall", [59, 0, 0], [2, 20, 120], "wall")

# Warehouse Outer Walls
# Front Z=12
add("wall", [-24, 0, 12], [16, 12, 1], "concrete") # -32 to -16
add("wall", [-12, 6, 12], [8, 6, 1], "concrete")   # Garage 1 Header (-16 to -8)
add("wall", [0, 0, 12], [16, 12, 1], "concrete")   # -8 to 8
add("wall", [12, 6, 12], [8, 6, 1], "concrete")    # Garage 2 Header (8 to 16)
add("wall", [24, 0, 12], [16, 12, 1], "concrete")  # 16 to 32

# Back Z=-36
add("wall", [-18, 0, -36], [28, 12, 1], "concrete") # -32 to -4
add("wall", [-2, 3, -36], [4, 9, 1], "concrete")    # Backdoor Header (-4 to 0)
add("wall", [16, 0, -36], [32, 12, 1], "concrete")  # 0 to 32

# Sides
add("wall", [-32, 0, -12], [1, 12, 48], "concrete") # Left
add("wall", [32, 0, -12], [1, 12, 48], "concrete")  # Right

# Roof with Skylight hole
add("floor", [-18, 12, -12], [28, 0.4, 49], "concrete") # Left piece
add("floor", [18, 12, -12], [28, 0.4, 49], "concrete")  # Right piece
add("floor", [0, 12, -26], [8, 0.4, 21], "concrete")    # Top piece
add("floor", [0, 12, 2], [8, 0.4, 21], "concrete")      # Bottom piece

# Roof barriers (prevent falling out of bounds easily from roof)
add("fence", [0, 12.4, -35.5], [64, 1.2, 0.2], "fence")
add("fence", [0, 12.4, 11.5], [64, 1.2, 0.2], "fence")
add("fence", [-31.5, 12.4, -12], [0.2, 1.2, 48], "fence")
add("fence", [31.5, 12.4, -12], [0.2, 1.2, 48], "fence")

# Skylight glass (walkable but transparent... wait, engine might not have glass material by default, we'll leave it as a hole)

# Office (CS Assault style)
add("floor", [24, 4, -28], [16, 0.4, 16], "concrete")
# Office Balcony Glass/Wall (Z=-20)
add("wall", [24, 4, -20], [16, 2, 1], "concrete")
# Office Left Wall (X=16)
add("wall", [16, 4, -26], [1, 1.5, 12], "concrete")  
add("wall", [16, 8, -26], [1, 4, 12], "concrete")    
add("wall", [16, 7.5, -34], [1, 4.5, 4], "concrete") 

# Office Stairs (X from 8 to 16, Z at -34.5)
for i in range(8):
    x = 8.5 + i * 1.0
    y = i * 0.5
    add("stair", [x, y, -34.5], [1.0, 0.5, 3], "concrete")

# Inside Catwalk (Left Wall)
add("floor", [-29, 6, -12], [6, 0.4, 48], "scaffold")
add("fence", [-26.1, 6.4, -12], [0.2, 1.2, 48], "fence")
# Stairs to inside Catwalk (starts Z=9.5, goes back to Z=-2)
for i in range(12):
    z = 9.5 - i * 1.0
    y = i * 0.5
    add("stair", [-29, y, z], [4, 0.5, 1.0], "scaffold")

# Outside Roof Stairs (Back of warehouse Z < -36)
for i in range(12):
    z = -37.5 - i * 1.0
    y = i * 0.5
    add("stair", [-14, y, z], [4, 0.5, 1.0], "scaffold")
add("floor", [-12, 6, -50.5], [8, 0.5, 4], "scaffold")
for i in range(12):
    z = -49.5 + i * 1.0
    y = 6.0 + i * 0.5
    add("stair", [-10, y, z], [4, 0.5, 1.0], "scaffold")
add("floor", [-10, 12, -37.5], [4, 0.5, 2], "scaffold")

# Truck Generator Function
def add_truck(cx, cz, rot="N", mat="crate", trailer_color="crate"):
    if rot == "N":
        add(mat, [cx, 0, cz-5], [2.6, 1.5, 2], mat)
        add(mat, [cx, 0, cz-2.5], [3, 3.2, 3], mat)
        add(trailer_color, [cx, 0, cz+4], [3.2, 4.5, 10], trailer_color)
    elif rot == "S":
        add(mat, [cx, 0, cz+5], [2.6, 1.5, 2], mat)
        add(mat, [cx, 0, cz+2.5], [3, 3.2, 3], mat)
        add(trailer_color, [cx, 0, cz-4], [3.2, 4.5, 10], trailer_color)
    elif rot == "E":
        add(mat, [cx+5, 0, cz], [2, 1.5, 2.6], mat)
        add(mat, [cx+2.5, 0, cz], [3, 3.2, 3], mat)
        add(trailer_color, [cx-4, 0, cz], [10, 4.5, 3.2], trailer_color)
    elif rot == "W":
        add(mat, [cx-5, 0, cz], [2, 1.5, 2.6], mat)
        add(mat, [cx-2.5, 0, cz], [3, 3.2, 3], mat)
        add(trailer_color, [cx+4, 0, cz], [10, 4.5, 3.2], trailer_color)

# Trucks
add_truck(12, 35, "N", "metal_barrel", "blue_tarp") 
add_truck(-15, 40, "E", "wall", "crate")
add_truck(-25, 20, "N", "crate", "blue_tarp")
add_truck(-12, 6, "S", "metal_barrel", "blue_tarp") # Inside Garage 1
add_truck(12, -15, "E", "wall", "wall") # Deep inside

# Crates & Containers
add("crate", [5, 0, -15], [3, 3, 7], "blue_tarp")
add("crate", [-5, 0, -25], [3, 3, 7], "crate")
add("crate", [5, 0, -25], [3, 6, 7], "blue_tarp")
add("crate", [12, 0, -10], [4, 2, 4], "crate")
add("crate", [-20, 0, -20], [2, 2, 2], "crate")
add("crate", [-22, 0, -20], [2, 2, 2], "crate")
add("crate", [25, 4.4, -25], [2, 1.2, 2], "crate") # In office

# Outside covers
add("crate", [0, 0, 25], [6, 1.5, 1], "crate")
add("crate", [25, 0, 30], [2, 2, 2], "crate")
add("crate", [-5, 0, 45], [2, 2, 2], "crate")

map_data = {
    "name": "Cargo (Assault/Train)",
    "size": [120, 120],
    "bounds": [-58, 58, -58, 58],
    "ambientLight": 0.5,
    "directionalLight": {
        "color": "#e0f0ff",
        "intensity": 0.9,
        "position": [50, 100, 20]
    },
    "staticGeometry": geometries,
    "doors": [],
    "playerSpawns": [
        [0, 0.1, 50],
        [-20, 0.1, 50],
        [20, 0.1, 50]
    ],
    "botSpawns": [
        [24, 4.1, -30],
        [-29, 6.1, -12],
        [0, 0.1, -30],
        [-10, 12.1, -12],
        [0, 12.1, 0],
        [-12, 0.1, -40],
        [20, 0.1, 30]
    ]
}

with open("assets/maps/cargo.json", "w") as f:
    json.dump(map_data, f, indent=2)
