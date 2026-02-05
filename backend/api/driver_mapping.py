"""
F1 Driver Number to Name Mapping (2018-2025)
Comprehensive mapping for all drivers across 8 seasons.
"""

DRIVER_NAMES = {
    # 2023-2025 Grid
    1: "Max Verstappen",
    2: "Logan Sargeant",
    3: "Daniel Ricciardo",
    4: "Lando Norris",
    10: "Pierre Gasly",
    11: "Sergio Perez",
    14: "Fernando Alonso",
    16: "Charles Leclerc",
    18: "Lance Stroll",
    20: "Kevin Magnussen",
    21: "Nyck de Vries",
    22: "Yuki Tsunoda",
    23: "Alex Albon",
    24: "Zhou Guanyu",
    27: "Nico Hulkenberg",
    31: "Esteban Ocon",
    38: "Oliver Bearman",
    40: "Liam Lawson",
    43: "Franco Colapinto",
    44: "Lewis Hamilton",
    55: "Carlos Sainz",
    63: "George Russell",
    77: "Valtteri Bottas",
    81: "Oscar Piastri",
    
    # 2021-2022 Drivers
    5: "Sebastian Vettel",
    6: "Nicholas Latifi",
    7: "Kimi Raikkonen",
    9: "Nikita Mazepin",
    47: "Mick Schumacher",
    99: "Antonio Giovinazzi",
    
    # 2018-2020 Drivers
    8: "Romain Grosjean",
    19: "Felipe Massa",
    26: "Daniil Kvyat",
    28: "Brendon Hartley",
    33: "Max Verstappen",  # Used #33 in 2018
    35: "Sergey Sirotkin",
    88: "Robert Kubica",
}

TEAM_NAMES = {
    # 2023-2025 Teams
    1: "Red Bull Racing",
    11: "Red Bull Racing",
    14: "Aston Martin",
    18: "Aston Martin",
    16: "Ferrari",
    55: "Ferrari",
    44: "Mercedes",
    63: "Mercedes",
    4: "McLaren",
    81: "McLaren",
    10: "Alpine",
    31: "Alpine",
    77: "Alfa Romeo",
    24: "Alfa Romeo",
    20: "Haas",
    27: "Haas",
    22: "AlphaTauri",
    3: "AlphaTauri",
    23: "Williams",
    2: "Williams",
    
    # Historical
    5: "Aston Martin",
    6: "Williams",
    7: "Alfa Romeo",
    9: "Haas",
    47: "Haas",
    99: "Alfa Romeo",
    8: "Haas",
    26: "AlphaTauri",
    28: "AlphaTauri",
    35: "Williams",
    88: "Williams",
}


def get_driver_name(driver_number: int) -> str:
    """Get driver name from number, with fallback."""
    return DRIVER_NAMES.get(driver_number, f"Driver {driver_number}")


def get_team_name(driver_number: int) -> str:
    """Get team name from driver number, with fallback."""
    return TEAM_NAMES.get(driver_number, "Unknown")
