import { Kysely, sql} from 'kysely'


export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable('boiler')
        .addColumn('time', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .addColumn('device_id', 'integer', (col) => col.notNull())
        .addColumn('temperature', 'real')
        .addColumn('pressure', 'real')
        .addColumn('water_level', 'real')
        .addColumn('flow_rate', 'real')
        .addColumn('fuel_consumption', 'real')
        .addColumn('steam_output', 'real')
        .addColumn('power_consumption', 'real')
        .addColumn('exhaust_gas_temperature', 'real')
        .addColumn('valve_status', 'text')
        .addColumn('vibration_level', 'real')
        .execute();

    await db.schema
        .createTable('greenhouse')
        .addColumn('time', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .addColumn('device_id', 'integer', (col) => col.notNull())
        .addColumn('temperature', 'real')
        .addColumn('humidity', 'real')
        .addColumn('soil_moisture', 'real')
        .addColumn('light_intensity', 'real')
        .addColumn('co2_level', 'real')
        .addColumn('water_level', 'real')
        .addColumn('fan_status', 'text')
        .addColumn('heater_status', 'text')
        .addColumn('irrigation_status', 'text')
        .addColumn('wind_speed', 'real')
        .execute();
        
    await db.schema
        .createTable('logistics')
        .addColumn('time', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .addColumn('device_id', 'integer', (col) => col.notNull())
        .addColumn('speed', 'real')
        .addColumn('engine_temperature', 'real')
        .addColumn('fuel_level', 'real')
        .addColumn('battery_voltage', 'real')
        .addColumn('oil_pressure', 'real')
        .addColumn('tire_pressure', 'real')
        .addColumn('gps_location', 'jsonb')
        .addColumn('brake_status', 'text')
        .addColumn('gear_position', 'text')
        .addColumn('acceleration', 'real')
        .execute();

    //making hypertables
    await db.executeQuery(sql`SELECT create_hypertable('boiler', 'time', if_not_exists => TRUE)`.compile(db));
    await db.executeQuery(sql`SELECT create_hypertable('greenhouse', 'time', if_not_exists => TRUE)`.compile(db));
    await db.executeQuery(sql`SELECT create_hypertable('logistics', 'time', if_not_exists => TRUE)`.compile(db)); 
}


export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable('boiler').execute()
    await db.schema.dropTable('logistics').execute()
    await db.schema.dropTable('greenhouse').execute()
}


