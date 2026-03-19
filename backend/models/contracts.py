from typing import Any, Dict, List, Optional
from datetime import datetime, date
from enum import Enum
from pydantic import BaseModel, Field


class SessionType(str, Enum):
    RACE = "R"
    QUALIFYING = "Q"
    SPRINT = "S"
    SPRINT_SHOOTOUT = "SS"
    PRACTICE_1 = "FP1"
    PRACTICE_2 = "FP2"
    PRACTICE_3 = "FP3"


class FlagState(str, Enum):
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    DOUBLE_YELLOW = "DOUBLE_YELLOW"
    RED = "RED"
    SAFETY_CAR = "SC"
    VIRTUAL_SAFETY_CAR = "VSC"


class DriverIdentity(BaseModel):
    driverId: str
    fullName: str
    shortName: Optional[str] = None
    driverNumber: Optional[int] = None
    nationality: Optional[str] = None
    dateOfBirth: Optional[str] = None
    wikipediaUrl: Optional[str] = None


class DriverCareerStats(BaseModel):
    starts: int = Field(default=0)
    wins: int = Field(default=0)
    podiums: int = Field(default=0)
    poles: int = Field(default=0)
    points: int = Field(default=0)
    championships: int = Field(default=0)
    bestFinish: Optional[int] = None
    bestQuali: Optional[int] = None
    bestRace: Optional[Dict[str, Any]] = None
    bestMoments: List[Dict[str, Any]] = Field(default_factory=list)
    seasonYears: List[int] = Field(default_factory=list)


class DriverProfile(BaseModel):
    driverId: str
    driverNumber: Optional[int] = None
    driverName: str
    fullName: Optional[str] = None
    teamName: str
    teamColor: Optional[str] = None
    nationality: Optional[str] = None
    nationalityFlag: Optional[str] = None
    age: Optional[int] = None
    dateOfBirth: Optional[str] = None
    wikipediaUrl: Optional[str] = None
    driverImage: Optional[str] = None
    teamImage: Optional[str] = None
    starts: int = Field(default=0)
    seasons: int = Field(default=0)
    seasonYears: List[int] = Field(default_factory=list)
    poles: int = Field(default=0)
    wins: int = Field(default=0)
    podiums: int = Field(default=0)
    points: int = Field(default=0)
    championships: int = Field(default=0)
    bestFinish: Optional[int] = None
    bestQuali: Optional[int] = None
    achievements: List[str] = Field(default_factory=list)
    records: List[str] = Field(default_factory=list)
    bestRace: Optional[Dict[str, Any]] = None
    bestMoments: List[str] = Field(default_factory=list)


class TeamProfile(BaseModel):
    teamId: str
    teamName: str
    teamColor: Optional[str] = None
    teamImage: Optional[str] = None
    seasons: int = Field(default=0)
    seasonYears: List[int] = Field(default_factory=list)
    starts: int = Field(default=0)
    wins: int = Field(default=0)
    podiums: int = Field(default=0)
    points: int = Field(default=0)
    championships: int = Field(default=0)
    bestFinish: Optional[int] = None
    records: List[str] = Field(default_factory=list)


class LivePosition(BaseModel):
    driverNumber: int
    position: int
    gap: Optional[float] = None
    interval: Optional[float] = None
    lapTime: Optional[float] = None
    lapNumber: Optional[int] = None
    pitStatus: Optional[int] = Field(default=0)
    tyreCompound: Optional[str] = None
    isPersonalBest: Optional[bool] = None


class LiveTiming(BaseModel):
    timestamp: datetime
    sessionKey: int
    positions: List[LivePosition] = Field(default_factory=list)
    raceControlMessages: List[Dict[str, Any]] = Field(default_factory=list)
    sessionStatus: Optional[str] = None


class LiveTelemetry(BaseModel):
    driverNumber: int
    timestamp: datetime
    speed: float
    throttle: float = Field(ge=0, le=100)
    brake: bool
    gear: int
    rpm: int
    drs: int = Field(ge=0, le=3)
    steering: float
    ersDeploy: Optional[float] = None
    brakeTempFL: Optional[float] = None
    brakeTempFR: Optional[float] = None
    brakeTempRL: Optional[float] = None
    brakeTempRR: Optional[float] = None
    tyreTempFL: Optional[float] = None
    tyreTempFR: Optional[float] = None
    tyreTempRL: Optional[float] = None
    tyreTempRR: Optional[float] = None


class SessionInfo(BaseModel):
    sessionKey: int
    meetingKey: int
    year: int
    meetingName: str
    sessionName: str
    sessionType: str
    dateStart: datetime
    dateEnd: Optional[datetime] = None
    gmtOffset: str


class MeetingInfo(BaseModel):
    meetingKey: int
    year: int
    meetingName: str
    countryName: str
    circuitShortName: str
    location: str
    dateStart: datetime
    sessions: List[SessionInfo] = Field(default_factory=list)


class ProfilesResponse(BaseModel):
    drivers: List[DriverProfile] = Field(default_factory=list)
    teams: List[TeamProfile] = Field(default_factory=list)
    generatedAt: datetime
    availableYears: List[int] = Field(default_factory=list)


class SeasonStandingsResponse(BaseModel):
    year: int
    roundsCount: int
    lastRace: str
    drivers: List[Dict[str, Any]] = Field(default_factory=list)
    constructors: List[Dict[str, Any]] = Field(default_factory=list)
    generatedAt: datetime


class CircuitInsightsResponse(BaseModel):
    year: int
    race: str
    circuitName: Optional[str] = None
    country: Optional[str] = None
    layoutYear: Optional[int] = None
    trackWidth: Optional[float] = None
    cornerCount: int = Field(default=0)
    drsZoneCount: int = Field(default=0)
    sectorCount: int = Field(default=3)
    pointCount: int = Field(default=0)
    facts: Dict[str, str] = Field(default_factory=dict)
    source: str
    sourceUrl: Optional[str] = None
    generatedAt: datetime


def driver_identity_to_profile(
    identity: DriverIdentity, career: Optional[DriverCareerStats] = None
) -> DriverProfile:
    team_name = identity.shortName if identity.shortName else identity.driverId

    return DriverProfile(
        driverId=identity.driverId,
        driverNumber=identity.driverNumber,
        driverName=identity.shortName or identity.driverId,
        fullName=identity.fullName,
        teamName=team_name,
        teamColor=None,
        nationality=identity.nationality,
        nationalityFlag=None,
        dateOfBirth=identity.dateOfBirth,
        wikipediaUrl=identity.wikipediaUrl,
        starts=career.starts if career else 0,
        seasons=len(career.seasonYears) if career else 0,
        seasonYears=career.seasonYears if career else [],
        poles=career.poles if career else 0,
        wins=career.wins if career else 0,
        podiums=career.podiums if career else 0,
        points=career.points if career else 0,
        championships=career.championships if career else 0,
        bestFinish=career.bestFinish if career else None,
        bestQuali=career.bestQuali if career else None,
    )


def merge_local_remote_driver(
    local: Dict,
    remote_identity: DriverIdentity,
    remote_career: Optional[DriverCareerStats] = None,
) -> DriverProfile:
    base_profile = driver_identity_to_profile(remote_identity, remote_career)

    local_driver = local.get("driver", {}) if isinstance(local, dict) else {}
    local_team = local.get("team", {}) if isinstance(local, dict) else {}

    return DriverProfile(
        driverId=base_profile.driverId,
        driverNumber=local_driver.get("number") or base_profile.driverNumber,
        driverName=local_driver.get("name") or base_profile.driverName,
        fullName=base_profile.fullName,
        teamName=local_team.get("name") or base_profile.teamName,
        teamColor=local_team.get("color") or base_profile.teamColor,
        nationality=local_driver.get("nationality") or base_profile.nationality,
        nationalityFlag=local_driver.get("nationalityFlag")
        or base_profile.nationalityFlag,
        age=local_driver.get("age") or base_profile.age,
        dateOfBirth=base_profile.dateOfBirth,
        wikipediaUrl=base_profile.wikipediaUrl,
        driverImage=local_driver.get("image") or base_profile.driverImage,
        teamImage=local_team.get("image") or base_profile.teamImage,
        starts=base_profile.starts,
        seasons=base_profile.seasons,
        seasonYears=base_profile.seasonYears,
        poles=base_profile.poles,
        wins=base_profile.wins,
        podiums=base_profile.podiums,
        points=base_profile.points,
        championships=base_profile.championships,
        bestFinish=base_profile.bestFinish,
        bestQuali=base_profile.bestQuali,
        achievements=local_driver.get("achievements", []) or base_profile.achievements,
        records=local_driver.get("records", []) or base_profile.records,
        bestRace=remote_career.bestRace if remote_career else base_profile.bestRace,
        bestMoments=[
            m.get("description", str(m))
            for m in (remote_career.bestMoments if remote_career else [])
        ]
        or base_profile.bestMoments,
    )
