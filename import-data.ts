import type { D1Database } from '@cloudflare/workers-types';
import JSZip from 'jszip';

interface PostalCode {
  country: string;
  postalCode: string;
  city: string;
  province: string;
  provinceCode: string;
  region: string;
  regionCode: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

interface ZipCodeFile {
  country_code: string;
  url: string;
  fileName: string;
}

export const countries: ZipCodeFile[] = [
  {
    country_code: 'US',
    url: 'https://download.geonames.org/export/zip/US.zip',
    fileName: 'US.txt',
  },
  {
    country_code: 'CA',
    url: 'https://download.geonames.org/export/zip/CA.zip',
    fileName: 'CA.txt',
  },
  {
    country_code: 'MX',
    url: 'https://download.geonames.org/export/zip/MX.zip',
    fileName: 'MX.txt',
  },
];

async function getCsvFile({
  url,
  fileName,
}: { url: string; fileName: string }) {
  console.log(`Downloading ZIP file from ${url}...`);
  const response = await fetch(url);

  if (!response.ok)
    throw new Error(`Failed to download ZIP file: ${response.statusText}`);

  const zipBuffer = await response.arrayBuffer();

  console.log(`Extracting ${fileName} from ZIP...`);

  const zip = new JSZip();
  await zip.loadAsync(zipBuffer);

  const file = zip.file(fileName);
  if (!file) throw new Error(`${fileName} not found in ZIP file`);

  return await file.async('text');
}

async function importCountryData(db: D1Database, country: ZipCodeFile) {
  try {
    await db.exec(
      'CREATE TABLE IF NOT EXISTS postal_codes (' +
        'country TEXT, ' +
        'postal_code TEXT, ' +
        'city TEXT, ' +
        'province TEXT, ' +
        'province_code TEXT, ' +
        'region TEXT, ' +
        'region_code TEXT, ' +
        'latitude REAL, ' +
        'longitude REAL, ' +
        'accuracy INTEGER, ' +
        'PRIMARY KEY (postal_code, country)' +
        ')',
    );
  } catch (error) {
    console.error('Error creating table', error);
    throw error;
  }

  const csvContent = await getCsvFile(country);

  const lines = csvContent.split('\n');

  console.log(`Total lines in file: ${lines.length}`);

  // Prepare the data for batch insert
  const values: PostalCode[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split('\t');
    if (parts.length < 10) {
      // console.log(`Skipping invalid line: ${line}`);
      continue;
    }

    const [
      country,
      postalCode,
      city,
      province,
      provinceCode,
      region,
      regionCode,
      latitude,
      longitude,
      accuracy,
    ] = parts;

    if (
      !country ||
      !postalCode ||
      !city ||
      !province ||
      !provinceCode ||
      !region ||
      !regionCode
    ) {
      // console.log(`Skipping line with missing data: ${line}`);
      continue;
    }

    values.push({
      country,
      postalCode,
      city,
      province,
      provinceCode,
      region,
      regionCode,
      latitude: latitude ? Number.parseFloat(latitude) : null,
      longitude: longitude ? Number.parseFloat(longitude) : null,
      accuracy: accuracy ? Number.parseInt(accuracy) : null,
    });
  }

  // Process in chunks of 100 for comparison
  const chunkSize = 1000;
  const updateBatchSize = 300;

  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    console.log(
      `Processing chunk ${i / chunkSize + 1} of ${Math.ceil(values.length / chunkSize)}`,
    );

    // Get existing records for this chunk
    const existingRecords = await db
      .prepare(`
      SELECT postal_code, latitude, longitude, accuracy
      FROM postal_codes
      WHERE postal_code IN (${chunk.map((v) => `'${v.postalCode.replace(/'/g, "''")}'`).join(', ')})
    `)
      .all();

    const existingMap = new Map(
      existingRecords.results.map((r) => [r.postal_code, r]),
    );

    // Find records that need updating
    const recordsToUpdate = chunk.filter((record) => {
      const existing = existingMap.get(record.postalCode);
      if (!existing) return true;

      return (
        existing.latitude !== record.latitude ||
        existing.longitude !== record.longitude ||
        existing.accuracy !== record.accuracy
      );
    });

    console.log(
      `Found ${recordsToUpdate.length} records to update in this chunk`,
    );

    // Update in smaller batches
    for (let j = 0; j < recordsToUpdate.length; j += updateBatchSize) {
      const batch = recordsToUpdate.slice(j, j + updateBatchSize);
      const values = batch
        .map(
          (v) => `(
        '${v.country.replace(/'/g, "''").toUpperCase()}',
        '${v.postalCode.replace(/'/g, "''").toUpperCase()}',
        '${v.city.replace(/'/g, "''")}',
        '${v.province.replace(/'/g, "''")}',
        '${v.provinceCode.replace(/'/g, "''")}',
        '${v.region.replace(/'/g, "''")}',
        '${v.regionCode.replace(/'/g, "''")}',
        ${!v.latitude ? 'NULL' : v.latitude},
        ${!v.longitude ? 'NULL' : v.longitude},
        ${!v.accuracy ? 'NULL' : v.accuracy}
      )`,
        )
        .join(',\n');

      await db
        .prepare(`
        INSERT OR REPLACE INTO postal_codes
        (country, postal_code, city, province, province_code, region, region_code, latitude, longitude, accuracy)
        VALUES ${values}
      `)
        .run();
    }
  }
}

async function importData(db: D1Database, country_code: string) {
  const country = countries.find((c) => c.country_code === country_code);
  if (!country) throw new Error(`Country ${country_code} not found`);
  await importCountryData(db, country);
}

export { importData };
