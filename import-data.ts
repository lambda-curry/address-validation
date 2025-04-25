import type { D1Database } from '@cloudflare/workers-types';
import JSZip from 'jszip';

interface PostalCode {
	country: string;
	postalCode: string;
	city: string;
	state: string;
	stateCode: string;
	county: string;
	countyCode: string;
	latitude: number | null;
	longitude: number | null;
	accuracy: number | null;
}

async function importData(db: D1Database) {
	// Create the table if it doesn't exist
	await db.exec(
		'CREATE TABLE IF NOT EXISTS postal_codes (' +
			'country TEXT, ' +
			'postal_code TEXT, ' +
			'city TEXT, ' +
			'state TEXT, ' +
			'state_code TEXT, ' +
			'county TEXT, ' +
			'county_code TEXT, ' +
			'latitude REAL, ' +
			'longitude REAL, ' +
			'accuracy INTEGER, ' +
			'PRIMARY KEY (postal_code)' +
			')',
	);

	// Download the ZIP file from geonames.org
	console.log('Downloading ZIP file from geonames.org...');
	const response = await fetch(
		'https://download.geonames.org/export/zip/US.zip',
	);
	if (!response.ok) {
		throw new Error(`Failed to download ZIP file: ${response.statusText}`);
	}

	// Get the ZIP file as an ArrayBuffer
	const zipBuffer = await response.arrayBuffer();

	// Extract the US.txt file from the ZIP
	console.log('Extracting US.txt from ZIP...');
	const zip = new JSZip();
	await zip.loadAsync(zipBuffer);

	const usTxtFile = zip.file('US.txt');
	if (!usTxtFile) {
		throw new Error('US.txt not found in ZIP file');
	}

	// Get the content of US.txt
	const fileContent = await usTxtFile.async('text');
	const lines = fileContent.split('\n');
	console.log(`Total lines in file: ${lines.length}`);

	// Prepare the data for batch insert
	const values: PostalCode[] = [];
	for (const line of lines) {
		if (!line.trim()) continue;

		const parts = line.split('\t');
		if (parts.length < 10) {
			console.log(`Skipping invalid line: ${line}`);
			continue;
		}

		const [
			country,
			postalCode,
			city,
			state,
			stateCode,
			county,
			countyCode,
			latitude,
			longitude,
			accuracy,
		] = parts;

		if (
			!country ||
			!postalCode ||
			!city ||
			!state ||
			!stateCode ||
			!county ||
			!countyCode
		) {
			console.log(`Skipping line with missing data: ${line}`);
			continue;
		}

		values.push({
			country,
			postalCode,
			city,
			state,
			stateCode,
			county,
			countyCode,
			latitude: latitude ? Number.parseFloat(latitude) : null,
			longitude: longitude ? Number.parseFloat(longitude) : null,
			accuracy: accuracy ? Number.parseInt(accuracy) : null,
		});
	}
	console.log(`Total valid records to insert: ${values.length}`);

	// Process in chunks of 100 for comparison
	const chunkSize = 1000;
	const updateBatchSize = 100;

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
        '${v.country.replace(/'/g, "''")}',
        '${v.postalCode.replace(/'/g, "''")}',
        '${v.city.replace(/'/g, "''")}',
        '${v.state.replace(/'/g, "''")}',
        '${v.stateCode.replace(/'/g, "''")}',
        '${v.county.replace(/'/g, "''")}',
        '${v.countyCode.replace(/'/g, "''")}',
        ${!v.latitude ? 'NULL' : v.latitude},
        ${!v.longitude ? 'NULL' : v.longitude},
        ${!v.accuracy ? 'NULL' : v.accuracy}
      )`,
				)
				.join(',\n');

			await db
				.prepare(`
        INSERT OR REPLACE INTO postal_codes
        (country, postal_code, city, state, state_code, county, county_code, latitude, longitude, accuracy)
        VALUES ${values}
      `)
				.run();
		}
	}
}

export { importData };
