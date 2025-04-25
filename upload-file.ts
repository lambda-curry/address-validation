import { readFileSync } from 'fs';
import { R2Bucket } from '@cloudflare/workers-types';

export default {
  async fetch(request: Request, env: { PostalCodeData: R2Bucket }) {
    try {
      // Read the file
      const fileContent = readFileSync('US.txt', 'utf-8');
      
      // Upload to R2
      await env.PostalCodeData.put('US.txt', fileContent, {
        httpMetadata: {
          contentType: 'text/plain',
        },
      });

      return new Response('File uploaded successfully', { status: 200 });
    } catch (error: any) {
      return new Response(`Error uploading file: ${error.message}`, { status: 500 });
    }
  },
}; 