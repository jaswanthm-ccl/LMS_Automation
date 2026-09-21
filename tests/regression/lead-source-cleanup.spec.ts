import { createServer, type Server } from 'node:http';
import { test, expect } from '@playwright/test';
import { deactivateLeadSourceIfActive } from '../../fixtures/lead-sources.fixture';

function listen(server: Server): Promise<number> {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                reject(new Error('Test server did not expose a TCP port'));
                return;
            }
            resolve(address.port);
        });
    });
}

function close(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
}

test('lead source cleanup rejects a malformed current-state response', async ({ page }) => {
    const server = createServer((_request, response) => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ data: {} }));
    });
    const port = await listen(server);
    try {
        const detailsUrl = `http://127.0.0.1:${port}/api/v1/lead-sources/123`;
        await expect(deactivateLeadSourceIfActive(page.request, {
            id: 123,
            detailsUrl,
            deactivateUrl: `${detailsUrl}/deactivate`,
        })).rejects.toThrow(
            /missing data\.deleted_at/i,
        );
    } finally {
        await close(server);
    }
});
