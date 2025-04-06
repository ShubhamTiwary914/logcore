
export type topicTables = 'boiler' | 'logistics' | 'greenhouse'


export interface Boiler {
    time: Date;
    deviceId: number;
    temperature: number | null;
    pressure: number | null;
    water_level: number | null;
    flow_rate: number | null;
    fuel_consumption: number | null;
    steam_output: number | null;
    power_consumption: number | null;
    exhaust_gas_temperature: number | null;
    valve_status: string | null;
    vibration_level: number | null;
}

export interface Greenhouse {
    time: Date;
    deviceId: number;
    temperature: number | null;
    humidity: number | null;
    soil_moisture: number | null;
    light_intensity: number | null;
    co2_level: number | null;
    water_level: number | null;
    fan_status: string | null;
    heater_status: string | null;
    irrigation_status: string | null;
    wind_speed: number | null;
}

export interface Logistics {
    time: Date;
    deviceId: number;
    speed: number | null;
    engine_temperature: number | null;
    fuel_level: number | null;
    battery_voltage: number | null;
    oil_pressure: number | null;
    tire_pressure: number | null;
    gps_location: any | null;
    brake_status: string | null;
    gear_position: string | null;
    acceleration: number | null;
}

export interface DatabaseSchema {
    boiler: Boiler;
    greenhouse: Greenhouse;
    logistics: Logistics;
}