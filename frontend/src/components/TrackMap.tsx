import React, { useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { MapView } from '@deck.gl/core';

interface TrackMapProps {
  year: number;
  round: number;
  session: string;
  selectedDriver?: string;
}

interface TrackPoint {
  x: number;
  y: number;
  z: number;
}

interface TrackData {
  path: TrackPoint[];
  corners: { name: string; position: TrackPoint }[];
  sectors: { start: number; end: number; sector: number }[];
  drsZones: { start: number; end: number; zone: number }[];
}

interface CarPosition {
  driver: string;
  position: TrackPoint;
  speed: number;
  drsActive: boolean;
  gear: number;
}

const SAMPLE_TRACK_DATA: TrackData = {
  path: [
    { x: 0, y: 0, z: 0 },
    { x: 100, y: 0, z: 0 },
    { x: 200, y: 50, z: 0 },
    { x: 250, y: 100, z: 5 },
    { x: 200, y: 150, z: 0 },
    { x: 100, y: 150, z: 0 },
    { x: 0, y: 100, z: 0 },
  ],
  corners: [
    { name: 'T1', position: { x: 100, y: 0, z: 0 } },
    { name: 'T2', position: { x: 200, y: 50, z: 5 } },
    { name: 'T3', position: { x: 250, y: 100, z: 5 } },
    { name: 'T4', position: { x: 200, y: 150, z: 0 } },
    { name: 'T5', position: { x: 100, y: 150, z: 0 } },
    { name: 'T6', position: { x: 0, y: 100, z: 0 } },
  ],
  sectors: [
    { start: 0, end: 2, sector: 1 },
    { start: 2, end: 4, sector: 2 },
    { start: 4, end: 6, sector: 3 },
  ],
  drsZones: [
    { start: 0, end: 1, zone: 1 },
    { start: 3, end: 4, zone: 2 },
  ],
};

const SAMPLE_CAR_POSITIONS: CarPosition[] = [
  { driver: 'VER', position: { x: 150, y: 75, z: 2 }, speed: 285, drsActive: true, gear: 6 },
  { driver: 'LEC', position: { x: 145, y: 70, z: 2 }, speed: 280, drsActive: false, gear: 6 },
  { driver: 'NOR', position: { x: 160, y: 80, z: 2 }, speed: 275, drsActive: false, gear: 5 },
  { driver: 'PIA', position: { x: 140, y: 65, z: 2 }, speed: 278, drsActive: true, gear: 6 },
];

const DRIVER_COLORS: Record<string, [number, number, number]> = {
  VER: [255, 0, 0],
  LEC: [0, 0, 255],
  NOR: [255, 165, 0],
  PIA: [255, 255, 0],
  HAM: [0, 128, 255],
  RUS: [128, 128, 128],
  ALM: [255, 255, 255],
  GAS: [0, 255, 128],
  OCO: [255, 128, 0],
  STR: [128, 0, 128],
};

export const TrackMap: React.FC<TrackMapProps> = ({
  year,
  round,
  session,
  selectedDriver,
}) => {
  const [carPositions] = useState<CarPosition[]>(SAMPLE_CAR_POSITIONS);
  const [viewState, setViewState] = useState({
    target: [125, 75, 0] as [number, number, number],
    zoom: 1.5,
    pitch: 45,
    bearing: 0,
    minZoom: 0,
    maxZoom: 10,
  });

  const trackPathLayer = useMemo(() => {
    const pathData = SAMPLE_TRACK_DATA.path.map(p => [p.x, p.y, p.z]);
    
    return new PathLayer({
      id: 'track-path',
      data: [{ path: pathData }],
      getPath: (d: { path: number[][] }) => d.path,
      getWidth: 8,
      getColor: [60, 60, 60],
      widthUnits: 'pixels',
      jointRounded: true,
      capRounded: true,
    });
  }, []);

  const drsZoneLayers = useMemo(() => {
    return SAMPLE_TRACK_DATA.drsZones.map((zone, index) => {
      const startPoint = SAMPLE_TRACK_DATA.path[zone.start];
      const endPoint = SAMPLE_TRACK_DATA.path[zone.end];
      
      return new PathLayer({
        id: `drs-zone-${index}`,
        data: [{
          path: [
            [startPoint.x, startPoint.y, 30 + zone.zone * 20],
            [endPoint.x, endPoint.y, 30 + zone.zone * 20],
          ],
        }],
        getPath: (d: { path: number[][] }) => d.path,
        getWidth: 6,
        getColor: [0, 255, 255, 150],
        widthUnits: 'pixels',
      });
    });
  }, []);

  const cornerLabelLayer = useMemo(() => {
    return new TextLayer({
      id: 'corner-labels',
      data: SAMPLE_TRACK_DATA.corners,
      getPosition: (d: { position: TrackPoint }) => [d.position.x, d.position.y, d.position.z + 10],
      getText: (d: { name: string }) => d.name,
      getSize: 16,
      getColor: [255, 255, 255],
      getAngle: 0,
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
      fontFamily: 'Arial',
      fontWeight: 'bold',
    });
  }, []);

  const sectorMarkerLayer = useMemo(() => {
    const sectorPoints = SAMPLE_TRACK_DATA.sectors.map(sector => {
      const midIndex = Math.floor((sector.start + sector.end) / 2);
      const midPoint = SAMPLE_TRACK_DATA.path[midIndex];
      return {
        sector: sector.sector,
        position: [midPoint.x, midPoint.y, midPoint.z + 5] as [number, number, number],
      };
    });
    
    return new TextLayer({
      id: 'sector-markers',
      data: sectorPoints,
      getPosition: (d: { position: [number, number, number] }) => d.position,
      getText: (d: { sector: number }) => `S${d.sector}`,
      getSize: 14,
      getColor: [255, 200, 0],
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
      fontFamily: 'Arial',
      fontWeight: 'bold',
    });
  }, []);

  const carPositionLayers = useMemo(() => {
    const filteredCars = selectedDriver
      ? carPositions.filter(car => car.driver === selectedDriver)
      : carPositions;
    
    return new ScatterplotLayer<CarPosition>({
      id: 'car-positions',
      data: filteredCars,
      getPosition: (d: CarPosition) => [d.position.x, d.position.y, d.position.z + 5],
      getRadius: 15,
      getFillColor: (d: CarPosition) => DRIVER_COLORS[d.driver] || [128, 128, 128],
      radiusUnits: 'pixels',
      stroked: true,
      getLineWidth: 2,
      getLineColor: [255, 255, 255],
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 100],
    });
  }, [carPositions, selectedDriver]);

  const speedAnnotationLayers = useMemo(() => {
    return carPositions.map(car => {
      return new TextLayer({
        id: `speed-${car.driver}`,
        data: [{ driver: car }],
        getPosition: (d: { driver: CarPosition }) => [
          d.driver.position.x + 20,
          d.driver.position.y,
          d.driver.position.z + 5,
        ] as [number, number, number],
        getText: (d: { driver: CarPosition }) => `${d.driver.speed} km/h`,
        getSize: 12,
        getColor: [255, 255, 255],
        getTextAnchor: 'start',
        getAlignmentBaseline: 'center',
        fontFamily: 'monospace',
      });
    });
  }, [carPositions]);

  const layers = [
    trackPathLayer,
    ...drsZoneLayers,
    cornerLabelLayer,
    sectorMarkerLayer,
    carPositionLayers,
    ...speedAnnotationLayers,
  ];

  return (
    <div className="track-map-container w-full h-full min-h-[500px] bg-gray-900 rounded-lg overflow-hidden">
      <DeckGL
        layers={layers}
        viewState={viewState}
        onViewStateChange={(e: { viewState: typeof viewState }) => setViewState(e.viewState as typeof viewState)}
        controller={{ dragRotate: true, scrollZoom: true }}
        views={new MapView({ controller: true })}
      />
      <div className="absolute top-4 left-4 bg-gray-800/80 backdrop-blur p-3 rounded-lg text-white">
        <h3 className="font-bold text-sm">Track Map</h3>
        <p className="text-xs text-gray-400">{year} R{round} - {session}</p>
        {selectedDriver && (
          <p className="text-xs text-blue-400">Selected: {selectedDriver}</p>
        )}
      </div>
      <div className="absolute bottom-4 left-4 bg-gray-800/80 backdrop-blur p-3 rounded-lg text-white">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
          <span>DRS Zone</span>
        </div>
        <div className="flex items-center gap-2 text-xs mt-1">
          <span className="w-3 h-3 rounded-full border-2 border-white" style={{ backgroundColor: 'rgb(255, 0, 0)' }}></span>
          <span>Car Position</span>
        </div>
      </div>
    </div>
  );
};

export default TrackMap;
