export default {
    async fetch(request) {
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        const { pathname } = new URL(request.url);

        // GET /               → chapter list
        // GET /chapter/1174   → chapter page data
        if (pathname === '/') {
            return fetchWindowData('https://onepiece.tube/manga/kapitel-mangaliste', 3600);
        }

        const chapterMatch = pathname.match(/^\/chapter\/(\d+)$/);
        if (chapterMatch) {
            const chapter = chapterMatch[1];
            return fetchWindowData(`https://onepiece.tube/manga/kapitel/${chapter}/1`, 3600);
        }

        return jsonError('Not found', 404);
    },
};

async function fetchWindowData(targetUrl, maxAge) {
    let html;
    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'de,en;q=0.9',
            },
        });

        if (!response.ok) {
            return jsonError(`Upstream returned ${response.status}`, 502);
        }

        html = await response.text();
    } catch (err) {
        return jsonError(`Fetch failed: ${err.message}`, 502);
    }

    const scriptMatch = html.match(/<script[^>]*>([\s\S]*?window\.__data[\s\S]*?)<\/script>/);
    if (!scriptMatch) {
        return jsonError('No script tag with window.__data found', 404);
    }

    const dataMatch = scriptMatch[1].match(/window\.__data\s*=\s*(\{[\s\S]*?\});?\s*(?:window\.|$)/);
    if (!dataMatch) {
        return jsonError('Could not extract window.__data value', 404);
    }

    let data;
    try {
        data = JSON.parse(dataMatch[1]);
    } catch (err) {
        return jsonError(`JSON parse failed: ${err.message}`, 500);
    }

    return new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': `public, max-age=${maxAge}`,
        },
    });
}

function jsonError(message, status) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
