import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.executeQuery(sql`
    CREATE MATERIALIZED VIEW boiler_aggregates
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('1 day', time) AS bucket,
      AVG(temperature) AS avg_temperature,
      MIN(temperature) AS min_temperature,
      MAX(temperature) AS max_temperature,
      AVG(pressure) AS avg_pressure,
      MIN(pressure) AS min_pressure,
      MAX(pressure) AS max_pressure
    FROM boiler
    GROUP BY bucket;
  `.compile(db));

  await db.executeQuery(sql`
    SELECT add_continuous_aggregate_policy('boiler_aggregates',
      start_offset => INTERVAL '1 month',
      end_offset => INTERVAL '1 day',
      schedule_interval => INTERVAL '1 hour');
  `.compile(db));

  await db.executeQuery(sql`
    CREATE MATERIALIZED VIEW greenhouse_aggregates
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('1 day', time) AS bucket,
      AVG(humidity) AS avg_humidity,
      MIN(humidity) AS min_humidity,
      MAX(humidity) AS max_humidity,
      AVG(soil_moisture) AS avg_moisture,
      MIN(soil_moisture) AS min_moisture,
      MAX(soil_moisture) AS max_moisture
    FROM greenhouse
    GROUP BY bucket;
  `.compile(db));

  await db.executeQuery(sql`
    SELECT add_continuous_aggregate_policy('greenhouse_aggregates',
      start_offset => INTERVAL '1 month',
      end_offset => INTERVAL '1 day',
      schedule_interval => INTERVAL '1 hour');
  `.compile(db));

  await db.executeQuery(sql`
    CREATE MATERIALIZED VIEW logistics_aggregates
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('1 day', time) AS bucket,
      AVG(speed) AS avg_speed,
      MIN(speed) AS min_speed,
      MAX(speed) AS max_speed,
      AVG(fuel_level) AS avg_fuel_level,
      MIN(fuel_level) AS min_fuel_level,
      MAX(fuel_level) AS max_fuel_level
    FROM logistics
    GROUP BY bucket;
  `.compile(db));

  await db.executeQuery(sql`
    SELECT add_continuous_aggregate_policy('logistics_aggregates',
      start_offset => INTERVAL '1 month',
      end_offset => INTERVAL '1 day',
      schedule_interval => INTERVAL '1 hour');
  `.compile(db));
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.executeQuery(sql`DROP MATERIALIZED VIEW IF EXISTS boiler_aggregates CASCADE;`.compile(db));
  await db.executeQuery(sql`DROP MATERIALIZED VIEW IF EXISTS greenhouse_aggregates CASCADE;`.compile(db));
  await db.executeQuery(sql`DROP MATERIALIZED VIEW IF EXISTS logistics_aggregates CASCADE;`.compile(db));
}
